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
        localStorage.setItem('lucidEmbedAuthCode', authCode)
    } else {
        console.error('Authorization code not found in URL')
    }

    window.location.href = 'https://jamiekrueger.dev'
})

