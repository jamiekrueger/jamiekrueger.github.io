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

// On page load, check if there is an existing embed to load
document.addEventListener("DOMContentLoaded", function() {
    // BAD EXAMPLE: Local Storage is a client-side cache, which means other visitors cannot access this embed session.
    // You should instead store the session token somewhere safe and persistable in your app so it can be used by all visitors.
    const sessionToken = localStorage.getItem('lucidEmbedSessionToken')
    if (sessionToken) {
        console.log(`Using stored embed session: ${sessionToken}`)
        updateIframeSrc(sessionToken)

        // Hide the form and show the reset button
        formContainer.classList.add('hidden')
        resetContainer.classList.remove('hidden')
    }
})

// Embed Lucid in your app
function updateIframeSrc(sessionToken) {
    const iframeSrc = `https://lucid.app/embeds?token=${sessionToken}`
    iframe.src = iframeSrc
    console.log("Updated iframe src:", iframeSrc)
    
    //TODO: retries and refreshes
}

// Listen for postMessage events from the iframe
window.addEventListener('message', (event) => {
    // Make sure the message is from the Lucidchart iframe
    console.log('GOT A MESSAGE EVENT:')
    console.log(event.origin)
    console.log(event.type)
    console.log(event.data)
    

    // TODO: Get the embed id
    // Use the embed id to generate new session token and store it 

    //if the message is that the session token is invalid/expired, figure out how to refresh the session
})

resetFormBtn.addEventListener('click', () => {
    localStorage.clear()

    iframe.src = ''

    // Hide the reset button and show the form
    formContainer.classList.remove('hidden')
    resetContainer.classList.add('hidden')
})
