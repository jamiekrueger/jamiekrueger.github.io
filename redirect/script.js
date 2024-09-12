document.addEventListener("DOMContentLoaded", async function() {
    const clientId = localStorage.getItem('lucidEmbedClientId')
    const clientSecret = localStorage.getItem('lucidEmbedClientSecret')
    const redirectUri = localStorage.getItem('lucidEmbedClientRedirectUri')
    if (!clientId || !clientSecret || !redirectUri) {
        console.log('Could not find client id, client secret, or redirect uri in local storage.')
    }

    // Find the authCode in the URL
    const urlParams = new URLSearchParams(window.location.search)
    const authCode = urlParams.get('code')

    if (authCode) {
        console.log('Authorization Code:', authCode)
    } else {
        console.error('Authorization code not found in URL')
    }

    const accessToken = await fetchAccessToken(clientId, clientSecret, redirectUri, authCode)
    await fetchEmbedSessionToken(accessToken)
})

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

async function fetchEmbedSessionToken(accessToken) {
    try {
        const response = await fetch( 'https://api.lucid.app/embeds/token', { 
            method: 'POST', 
            headers: new Headers(
                { 
                    "Content-Type": "application/json",
                    "Lucid-Api-Version": 1,
                    "Authorization": `Bearer ${accessToken}`}) ,
            body: JSON.stringify({ origin: 'jamiekrueger.dev' })
        })

        const sessionToken = await response.text()
        if (sessionToken) {
            console.log('Lucid Embed Session Token:', sessionToken)
            localStorage.setItem('lucidEmbedSessionToken', sessionToken)
            // Redirect the user back to the main page
            window.location.href = 'https://jamiekrueger.dev'
        } else {
            console.error('No session token found in the response.')
        }
    } catch (error) {
        console.error('Error creating embed session token:', error)
    }
}