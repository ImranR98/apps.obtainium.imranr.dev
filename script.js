let data = null

function getCategoriesSelectorHTML(categories, selectedCategories, langCode) {
    let html = `<select id="catSelect" style="width: 100%; min-height: 10em;" multiple>`
    for (const key in categories) {
        const category = categories[key]
        const displayName = category[langCode] || key
        const isSelected = selectedCategories.includes(key)
        html += `<option value="${key}" ${isSelected ? 'selected' : ''}>${displayName}</option>`
    }
    html += `</select>
    <button style="margin-top: 1em; width: 50%;" onclick="reloadWithSelected()">Go</button>`
    return html
}

function reloadWithSelected() {
    var selectElement = document.querySelector('#catSelect')
    var selectedValues = Array.from(selectElement.selectedOptions).map(option => option.value).join(',')
    window.location.href = `?categories=${selectedValues}`;
}

function getIconHTML(url, name) {
    const placeholderImage = "https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/icon_small.png"
    const placeholderStyle = "transform: rotate(0.31rad); opacity: 0.3;"
    const src = url ? url : placeholderImage
    const style = url ? '' : placeholderStyle
    return `<img src="${src}" alt="${name || 'App'} Icon" style="max-width: 0.9em; max-height: 0.9em; border-radius: 5px; ${style}">`
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied!')
    }).catch(err => {
        console.error(err)
    })
}

function copyAppToClipboard(appId) {
    if (data) {
        let app = data.apps.filter(app => app.config.id == appId)[0]
        if (app) {
            copyToClipboard(JSON.stringify(app.config))
        }
    }
}

function getAppEntryHTML(appJson, langCode, allCategories) {
    const description = appJson.description[langCode] || ''
    const appCats = appJson.categories.map(category =>
        `<a href="?categories=${encodeURIComponent(category)}" style="text-decoration: underline;">${allCategories[category][langCode]}</a>`).join(", ")
    return `
        <div style="margin: 1em auto; padding: 1em; border: 1px solid #ccc; border-radius: 5px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
            <h1 style="margin-bottom: 10px;">${getIconHTML(appJson.icon, appJson.config.name)}&nbsp;<a href="${appJson.config.url}" style="text-decoration: underline; color: inherit;">${appJson.config.name}</a></h1>
            

            <p>${description}</p>
            <div>
                <a href="obtainium://app/${encodeURIComponent(appJson.config)}">Add to Obtainium</a>
            </div>
            <div style="margin-top: 0.5em;">
                <a href="javascript:void(0);" onclick="copyAppToClipboard('${appJson.config.id}')">Copy App Config to Clipboard</a>
            </div>
            <p style="font-size: 0.9em; color: #555;">Categories: ${appCats}</p>
        </div>
    `
}

function getAppEntriesHTML(appsJson, allCategories, selectedCategories, langCode) {
    appsJson = appsJson.map(app => {
        app.categories = app.categories || []
        app.categories = app.categories.filter(c => Object.keys(allCategories).indexOf(c) >= 0) // Ignore any non-existent categories
        if (app.categories.length == 0) {
            app.categories = ['other'] // Use the default if no cats were specified
        }
        return app
    }).filter(app =>
        app.categories.some(item => selectedCategories.includes(item))
    )
    if (appsJson.length > 0) {
        return appsJson.map(appJson => getAppEntryHTML(appJson, langCode, allCategories))
    } else {
        return '<strong>No Apps Found!</strong>'
    }
}

function render() {
    let selectedCategories = ((new URLSearchParams(window.location.search)).get('categories') || '').split(',').filter(c => c.trim())
    if (!selectedCategories || selectedCategories.length == 0) {
        selectedCategories = Object.keys(data.categories)
    }
    const langCode = ((navigator.language || navigator.userLanguage) || 'en-US').split('-')[0]
    document.querySelector('#categories').innerHTML = getCategoriesSelectorHTML(data.categories, selectedCategories, langCode)
    document.querySelector('#apps').innerHTML = getAppEntriesHTML(data.apps, data.categories, selectedCategories, langCode)
}

async function fetchAsync(url) {
    let response = await fetch(url)
    let data = await response.json()
    return data
}

window.addEventListener('load', () => {
    fetchAsync('/data.json')
        .then((d) => {
            data = d
            render()
        }).catch((err) => {
            console.error(err)
            alert('Error! See console for details.')
        })
})

// For local testing: python -m http.server 8080