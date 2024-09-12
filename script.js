const formContainer = document.getElementById('form-container')
const clientIdInput = document.getElementById('clientId')
const clientSecretInput = document.getElementById('clientSecret')
const createEmbedSessionBtn = document.getElementById('createEmbedSession')
const resetContainer = document.getElementById('reset-container')
const resetFormBtn = document.getElementById('resetForm')
const iframe = document.getElementById('lucidchart-frame')

// Send the user through the OAuth 2.0 authorization code flow
createEmbedSessionBtn.addEventListener('click', () => {
    const clientId = clientIdInput.value
    const clientSecret = clientSecretInput.value
    const redirectUri = 'https://jamiekrueger.dev/redirect'
    const scope = 'lucidchart.document.app.picker.share.embed'

    // Simple validation to ensure inputs are not empty
    if (!clientId || !clientSecret) {
        alert('Please fill in all fields.')
        return
    }

    const authUrl = `https://lucid.app/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`

    localStorage.setItem('lucidEmbedClientId', clientId)
    localStorage.setItem('lucidEmbedClientSecret', clientSecret)
    localStorage.setItem('lucidEmbedClientRedirectUri', redirectUri)

    // Redirect the user to the authorization page
    window.location.href = authUrl
})

// On page load, check if there is an existing embed id to load
document.addEventListener("DOMContentLoaded", function() {
    const embedId = localStorage.getItem('lucidEmbedId')
    const clientId = localStorage.getItem('lucidEmbedClientId')
    const clientSecret = localStorage.getItem('lucidEmbedClientSecret')
    const redirectUri = localStorage.getItem('lucidEmbedRedirectUri')
    const authCode = localStorage.getItem('lucidEmbedAuthCode')

    if (clientId && clientSecret && redirectUri && authCode) {
        console.log(`Using stored embed Id: ${embedId}`)
        const accessToken = fetchAccessToken(clientId, clientSecret, redirectUri, authCode)
        if (!accessToken) return
        const sessionToken = fetchSessionToken(accessToken, embedId)
        if (!sessionToken) return
        updateIframeSrc(sessionToken)

        // Hide the form and show the reset button
        formContainer.classList.add('hidden')
        resetContainer.classList.remove('hidden')
    }
})

async function fetchSessionToken(accessToken, embedId) {
    try {
        const response = await fetch( 'https://api.lucid.app/embeds/token', { 
            method: 'POST', 
            headers: new Headers(
                { 
                    "Content-Type": "application/json",
                    "Lucid-Api-Version": 1,
                    "Authorization": `Bearer ${accessToken}`}) ,
            body: JSON.stringify({
                origin: 'https://jamiekrueger.dev',
                embedId: embedId
            })
        })

        const sessionToken = await response.text()
        if (sessionToken) {
            console.log('Lucid Embed Session Token:', sessionToken)
            localStorage.setItem('lucidEmbedSessionToken', sessionToken) //do i need to store this?
            return sessionToken
        } else {
            console.error('No session token found in the response.')
        }
    } catch (error) {
        console.error('Error creating embed session token:', error)
    }
}

async function fetchAccessToken(clientId, clientSecret, redirectUri, authCode) {
    try {
        const response = await fetch( 'https://api.lucid.app/oauth2/token', { 
            method: 'POST', 
            headers: new Headers({ 
                "Content-Type": "application/json"
            }) ,
            body: JSON.stringify({ 
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code: authCode
            })
        })
        const data = await response.json()
        const accessToken = data.access_token
        if (accessToken) {
            console.log('Access Token:', accessToken)
            localStorage.setItem('lucidEmbedAccessToken', accessToken)
            return accessToken
        } else {
            console.error('No access token found in the response:', data)
        }
    } catch (error) {
        console.error('Error creating access token:', error)
    }
}

// Embed Lucid in your app
function updateIframeSrc(sessionToken) {
    const iframeSrc = `https://lucid.app/embeds?token=${sessionToken}`
    iframe.src = iframeSrc
    console.log("Updated iframe src:", iframeSrc)
    
    //TODO: retries and refreshes
}

// Listen for postMessage events from the iframe
window.addEventListener('message', (event) => {
    if (event.origin === "https://lucid.app") {
        if (event.type === 'LucidEmbedEvent') {
            if (event.event === 'EmbedCreated') {
                const embedId = event.embedId
                if (!embedId) {
                    console.error('No embed Id found in the EmbedCreated event.')
                    return
                }
                console.log(`Embed Created with id: ${event.embedId}`)
                localStorage.setItem('lucidEmbedId', embedId)
            }
        } else {
            console.log('GOT SOME OTHER LUCID MESSAGE EVENT:')
            console.log(event.origin)
            console.log(event.type)
            console.log(event.data)
            //if the message is that the session token is invalid/expired, figure out how to refresh the session
        }
    }
})

resetFormBtn.addEventListener('click', () => {
    localStorage.clear()

    iframe.src = ''

    // Hide the reset button and show the form
    formContainer.classList.remove('hidden')
    resetContainer.classList.add('hidden')
})
