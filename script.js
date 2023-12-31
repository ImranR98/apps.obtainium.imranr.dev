let data = null

function getCategoriesSelectorHTML(categories, selectedCategories, langCode) {
    let selectHTML = `
    <select id="catSelect" class="select is-fullwidth" style="min-height: 6em;" multiple>`
    for (const key in categories) {
        const category = categories[key]
        const displayName = category[langCode] || key
        const isSelected = selectedCategories.includes(key)
        selectHTML += `<option value="${key}" ${isSelected ? 'selected' : ''}>${displayName}</option>`
    }
    selectHTML += `</select>`
    buttonHTML = `<a class="button is-fullwidth is-primary" style="height: 100%;" href="javascript:void(0);" onclick="reloadWithSelected()">Go</a>`
    let html = `<div class="container">
    <label for="catSelect" class="label">Select App Categories:</label>
        <div class="columns">
            <div class="column">
                <div class="field is-grouped">
                    <div class="control is-expanded">
                        ${selectHTML}
                    </div>
                    <div class="control">
                        ${buttonHTML}
                    </div>
                </div>
            </div>
        </div>
    </div>`
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
        <div class="card mt-4">
            <div class="card-content">
                <p class="title is-flex is-justify-content-space-between">
                    <a href="${appJson.config.url}" style="text-decoration: underline; color: inherit;">${appJson.config.name}</a>
                    ${getIconHTML(appJson.icon, appJson.config.name)}
                </p>

                <p class="subtitle">${description}</p>
                <a class="button is-primary" href="obtainium://app/${encodeURIComponent(JSON.stringify(appJson.config))}">Add to Obtainium</a>
                <a class="button is-secondary" href="javascript:void(0);" onclick="copyAppToClipboard('${appJson.config.id}')">Copy App Config to Clipboard</a>
                <p class="is-size-7 mt-4" style="color: #555;">Categories: ${appCats}</p>
            </div>
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
    fetchAsync(`/data.json?rand=${Math.random() * 10000}`) // Prevent caching of this file
        .then((d) => {
            data = d
            render()
        }).catch((err) => {
            console.error(err)
            alert('Error! See console for details.')
        })
})

// For local testing: python -m http.server 8080