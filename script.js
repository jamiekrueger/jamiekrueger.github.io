// DOM elements
const authorizeButton = document.getElementById('authorize-button')
const iframe = document.getElementById('lucidchart-frame')

// Local storage values
const CLIENT_ID = localStorage.getItem('lucidEmbedClientId')
const CLIENT_SECRET = localStorage.getItem('lucidEmbedClientSecret')
const CLIENT_REDIRECT_URI = localStorage.getItem('lucidEmbedClientRedirectUri')
const ACCESS_TOKEN = localStorage.getItem('lucidEmbedAccessToken')
const EXPIRES = localStorage.getItem('lucidEmbedAccessTokenExpires')
const REFRESH_TOKEN = localStorage.getItem('lucidEmbedRefreshToken')
const AUTH_CODE = localStorage.getItem('lucidEmbedAuthCode')
const EMBED_ID = localStorage.getItem('lucidEmbedId')

// Scopes requried to create an embed session
const SCOPES = 'lucidchart.document.app.picker.share.embed+offline_access'

authorizeButton.addEventListener('click', () => {
  authorizationCodeFlow()
})

/**
 * Directs the user to the authorization page, and redirects with AUTH_CODE set in local storage
 */
function authorizationCodeFlow() {
    const authUrl = `https://lucid.app/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${CLIENT_REDIRECT_URI}&scope=${SCOPES}`
    window.location.href = authUrl
}

/**
 * Generates a new embed session whenever the app is reloaded
 */
document.addEventListener("DOMContentLoaded", async function() {
    const accessToken = getAccessToken()
    const sessionToken = fetchSessionToken(accessToken, EMBED_ID)
    iframe.src = `https://lucid.app/embeds?token=${sessionToken}`
})


/** 
 * Refreshes an existing access token or creates a new access token 
 */
async function getAccessToken() {
    if (ACCESS_TOKEN) {
        if (isExpiredOrWithinTenMinutes(EXPIRES)) {
            return fetchRefreshToken(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
        }
    }

    return fetchAccessToken(CLIENT_ID, CLIENT_SECRET, CLIENT_REDIRECT_URI, AUTH_CODE)
}

/**
 * @param {*} time milliseconds elapsed since the UNIX epoch
 * @returns true if the time is in the past or within 10 minutes of the current time
 */
function isExpiredOrWithinTenMinutes(time) {
    if (!time) return true
    const tenMinutesInMillis = 10 * 60 * 1000
    const currentTime = Date.now()
    return (time - currentTime) <= tenMinutesInMillis && time > currentTime
}


/**
 * @param {*} accessToken an access token with the `lucidchart.document.app.picker.share.embed` & `offline_access` scopes
 * @param {*} embedId (optional) an embed id saved from a previous `EmbedCreated` event
 * @returns a fresh embed session token, or undefined
 */
async function fetchSessionToken(accessToken, embedId) {
    console.log('FETCHING SESSION TOKEN')

    // If there is an existing embed to load, provide the embed id in the request body
    const maybeEmbedId = embedId ? {embedId: embedId} : {}

    try {
        const response = await fetchWithRetry( 'https://api.lucid.app/embeds/token', { 
            method: 'POST', 
            headers: new Headers({ 
                "Content-Type": "application/json",
                "Lucid-Api-Version": 1,
                "Authorization": `Bearer ${accessToken}`
            }),
            body: JSON.stringify({
                ...maybeEmbedId,
                origin: 'https://jamiekrueger.dev'
            })
        })

        const sessionToken = await response.text()
        if (sessionToken) {
            console.log('Lucid Embed Session Token:', sessionToken)
            return sessionToken
        } else {
            console.error('No session token found in the response.')
        }
    } catch (error) {
        console.error('Error creating embed session token:', error)
    }
}

/**
 * Fetches a fresh access token
 * @param {*} clientId A Lucid OAuth 2.0 client id
 * @param {*} clientSecret The Lucid OAuth 2.0 client's secret
 * @param {*} redirectUri This application's authorized redirect uri
 * @param {*} code The authorization code obtained during the auth flow
 * @returns a fresh access token with the previously authorized access scopes, or undefined
 */
async function fetchAccessToken(clientId, clientSecret, redirectUri, code) {
    console.log('FETCHING ACCESS TOKEN')

    if (!clientId || !clientSecret || !redirectUri || !code) return

    try {
        const response = await fetchWithRetry( 'https://api.lucid.app/oauth2/token', { 
            method: 'POST', 
            headers: new Headers({ 
                "Content-Type": "application/json"
            }) ,
            body: JSON.stringify({ 
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code: code
            })
        })
        const data = await response.json()

        const accessToken = data.access_token
        const expires = data.expires
        const refreshToken = data.refresh_token
        if (accessToken && expires && refreshToken) {
            localStorage.setItem('lucidEmbedAccessToken', accessToken)
            localStorage.setItem('lucidEmbedAccessTokenExpires', expires)
            localStorage.setItem('lucidEmbedRefresh', refreshToken)
            return accessToken
        } else {
            console.error('Error parsing response response body:', data)
        }
    } catch (error) {
        console.error('Error creating access token:', error)
    }
}

/**
 * Fetches a fresh access token from a saved refresh token
 * @param {*} clientId A Lucid OAuth 2.0 client id
 * @param {*} clientSecret The Lucid OAuth 2.0 client's secret 
 * @param {*} refreshToken An unexpired refresh token associated with an expired/expiring access token
 * @returns A fresh access token with the same access scopes as the expired/expiring access token
 */
async function fetchRefreshToken(clientId, clientSecret, refreshToken) {
    console.log('FETCHING REFRESH TOKEN')

    if (!clientId || !clientSecret || !refreshToken) return

    try {
        const response = await fetchWithRetry( 'https://api.lucid.app/oauth2/token', { 
            method: 'POST', 
            headers: new Headers({ 
                "Content-Type": "application/json"
            }) ,
            body: JSON.stringify({ 
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        })
        const data = await response.json()
        const accessToken = data.access_token
        const refreshToken = data.refresh_token

        if (accessToken && refreshToken) {
            console.log('Access Token:', accessToken)
            console.log('Refresh Token:', refreshToken)

            localStorage.setItem('lucidEmbedAccessToken', accessToken)
            localStorage.setItem('lucidEmbedRefreshToken', refreshToken)
            return accessToken
        } else {
            console.error('Error parsing response body:', data)
        }
    } catch (error) {
        console.error('Error creating refresh token:', error)
    }
}

// Listens for postMessage events from the iFrame
window.addEventListener('message', (event) => {
    if (event.origin === "https://lucid.app") {
        console.log(event)
        console.log(event.origin)
        console.log(event.type)
        console.log(event.data)
        console.log(event.event)

        if (event.type === 'LucidEmbedEvent') {
            console.log('GOT A LUCID EMBED EVENT:')

            if (event.event === 'EmbedCreated') {
                console.log('IT WAS AN EMBED CREATED EVENT')
            //     const embedId = event.embedId
            //     if (!embedId) {
            //         console.error('No embed Id found in the EmbedCreated event.')
            //         return
            //     }
            //     console.log(`Embed Created with id: ${event.embedId}`)
            //     localStorage.setItem('lucidEmbedId', embedId)
            }
        } else {
            console.log('GOT SOME OTHER LUCID MESSAGE EVENT:')

            //if the message is that the session token is invalid/expired, figure out how to refresh the session
        }
    }
})

/**
 * Retries a fetch() request a set number of times if the request fails due to network issues, etc...
 * @param  {...any} args fetch() request input
 * @returns fetch() response
 */
async function fetchWithRetry(...args) {
  let retryCount = 5;
  while(retryCount > 0) {
    try {
      return await fetch(...args);
    } catch(error) {
        console.error(error)
    }
    retryCount -= 1;
  }

  throw new Error(`Too many retries`);
}  