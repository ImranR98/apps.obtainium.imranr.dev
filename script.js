let data = null
const langCode = ((navigator.language || navigator.userLanguage) || 'en-US').split('-')[0]

function getString(key){
    return getLocalString(data.strings[key]);
}

function getCategoriesSelectorHTML(categories, selectedCategories) {
    let selectHTML = `
    <select id="catSelect" class="select is-fullwidth" style="min-height: 6em;" multiple>`
    for (const key in categories) {
        const category = categories[key]
        const displayName = getLocalString(category) || key
        const isSelected = selectedCategories.includes(key)
        selectHTML += `<option value="${key}" ${isSelected ? 'selected' : ''}>${displayName}</option>`
    }
    selectHTML += `</select>`
    const buttonHTML = `<a class="button is-fullwidth is-primary" style="height: 100%;" href="javascript:void(0);" onclick="reloadWithSelected()">${getString('go')}</a>`
    const searchHTML = `<input placeholder="${getString('search')}" type="search" class="input is-fullwidth" oninput="search(event)">`
    const html = `<div class="container">
    <label for="catSelect" class="label">${getString('categorySelect')}:</label>
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
                <div class="field">
                    <div class="control">
                        ${searchHTML}
                    </div>
                </div>
            </div>
        </div>
    </div>`
    return html
}

function search(event){
    const regex = new RegExp(event.target.value,'ims');
    document.querySelectorAll('#apps > *').forEach((element,appIndex) => {
        const app = data.selectedApps[appIndex];
        element.style.display = regex.test([
                app.config.id,
                app.config.name,
                Object.values(app.description||{}).join('\n')
            ].join('\n'))?'':'none';
    });
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
    return url ? `<img src="${src}" alt="${name || 'App'} Icon" style="max-width: 0.9em; max-height: 0.9em; border-radius: 5px; ${style}">` : '<div></div>'
}

function getLocalString(langObject){
    return langObject ? (langObject[langCode] || langObject.en||'') : '';
}

function getAppConfigString(appJson){
    const config = appJson.config;
    const description = getLocalString(appJson.description);
    if(description){
        const settings = JSON.parse(config.additionalSettings);
        if(!settings.about) settings.about = description;
        config.additionalSettings = JSON.stringify(settings);
    }
    return JSON.stringify(config);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied!')
    }).catch(err => {
        console.error(err)
    })
}

function copyAppToClipboard(appIndex) {
    if (data) {
        let app = data.selectedApps[appIndex]
        if (app) {
            copyToClipboard(getAppConfigString(app))
        }
    }
}

function getAppEntryHTML(appJson, appIndex, allCategories) {
    const description = getLocalString(appJson.description);
    const appCats = appJson.categories.map(category =>
        `<a href="?categories=${encodeURIComponent(category)}" style="text-decoration: underline;">${getLocalString(allCategories[category])}</a>`).join(', ')
    return `<div class="card mt-4">
            <div class="card-content">
                <p class="title is-flex is-justify-content-space-between">
                    <a href="${appJson.config.url}" style="text-decoration: underline; color: inherit;">${appJson.config.name}</a>
                    ${getIconHTML(appJson.icon, appJson.config.name)}
                </p>

                <p class="subtitle">${description}</p>
                <a class="button is-primary" href="obtainium://app/${encodeURIComponent(getAppConfigString(appJson))}">
                    ${getString('addToObtainium')}
                </a>
                <a class="button is-secondary" href="javascript:void(0);" onclick="copyAppToClipboard('${appIndex}')">
                    ${getString('copyAppConfig')}
                </a>
                <p class="is-size-7 mt-4" style="color: #555;">${getString('categories')}: ${appCats}</p>
            </div>
        </div>`
}

function getAppEntriesHTML(appsJson, allCategories, selectedCategories) {
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
    data.selectedApps = appsJson;
    if (appsJson.length > 0) {
        return appsJson.map((appJson,appIndex) => getAppEntryHTML(appJson, appIndex, allCategories)).join('\n')
    } else {
        return '<strong>No Apps Found!</strong>'
    }
}

function render() {
    let selectedCategories = ((new URLSearchParams(window.location.search)).get('categories') || '').split(',').filter(c => c.trim())
    if (!selectedCategories || selectedCategories.length == 0) {
        selectedCategories = Object.keys(data.categories)
    }
    document.querySelector('#categories').innerHTML = getCategoriesSelectorHTML(data.categories, selectedCategories)
    document.querySelector('#apps').innerHTML = getAppEntriesHTML(data.apps, data.categories, selectedCategories)
    document.querySelector('#title').innerHTML = getString('title')
    document.querySelector('#subtitle').innerHTML = getString('subtitle')
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
