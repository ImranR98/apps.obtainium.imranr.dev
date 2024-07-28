let data = null
const langCode = ((navigator.language || navigator.userLanguage) || 'en-US').split('-')[0]

function getString(key) {
    return getLocalString(data.strings[key])
}

function getCategoriesSelectorHTML(apps, categories, selectedCategories) {
    const usedCategories = Array.from(new Set(apps.reduce((prev, curr) => [...prev, ...(curr.categories || [])], [])))
    let selectHTML = `
    <select id="catSelect" class="select is-fullwidth" style="min-height: 6em;" multiple>`
    Object.keys(categories)
        .map(key => {
            return {
                key,
                category: categories[key],
                displayName: getLocalString(categories[key]) || key,
                isSelected: selectedCategories.includes(key),
                unused: !usedCategories.includes(key)
            }
        })
        .sort((da, db) => {
            if (da.unused != db.unused) {
                return da.unused ? 1 : -1
            }
            return da.displayName.localeCompare(db.displayName)
        })
        .forEach(d => selectHTML += `<option ${d.unused ? 'disabled' : ''} value="${d.key}" ${d.isSelected ? 'selected' : ''}>${d.displayName}</option>`)
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

function search(event) {
    const regex = new RegExp(event.target.value, 'ims')
    document.querySelectorAll('#apps > *').forEach((element, appIndex) => {
        const app = data.selectedApps[appIndex]
        element.style.display = regex.test([
            app.configs[0].id,
            Array.from(new Set(app.configs.map(c => c.name))).join(' '),
            Object.values(app.description || {}).join('\n')
        ].join('\n')) ? '' : 'none'
    })
}

function reloadWithSelected() {
    var selectElement = document.querySelector('#catSelect')
    var selectedValues = Array.from(selectElement.selectedOptions).map(option => option.value).join(',')
    window.location.href = `?categories=${selectedValues}`
}

function getIconHTML(url, name) {
    const placeholderImage = "https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/icon_small.png"
    const placeholderStyle = "transform: rotate(0.31rad); opacity: 0.3;"
    const src = url ? url : placeholderImage
    const style = url ? '' : placeholderStyle
    return url ? `<img src="${src}" alt="${name || 'App'} Icon" style="max-width: 20em; max-height: 3.5em; border-radius: 5px; ${style}">` : '<div></div>'
}

function getLocalString(langObject) {
    return langObject ? (langObject[langCode] || langObject.en || '') : ''
}

function getAppConfigString(appJson, configIndex = 0) {
    const config = appJson.configs[configIndex]
    const description = getLocalString(appJson.description)
    if (description) {
        if (!config.additionalSettings) {
            config.additionalSettings = '{}'
        }
        let settings
        try {
            settings = JSON.parse(config.additionalSettings)
        } catch (e) {
            console.error(config)
            throw e
        }
        if (!settings.about) settings.about = description
        config.additionalSettings = JSON.stringify(settings)
    }
    if (config.altLabel) {
        delete config.altLabel
    }
    return JSON.stringify(config)
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Copied!')
    }).catch(err => {
        console.error(err)
    })
}

function copyAppToClipboard(appIndex, configIndex = 0) {
    if (data) {
        let app = data.selectedApps[appIndex]
        if (app) {
            copyToClipboard(getAppConfigString(app, configIndex))
        }
    }
}

function getAppEntryHTML(appJson, appIndex, allCategories) {
    const description = getLocalString(appJson.description)
    const firstAppLabelElement = appJson.configs[0].altLabel || appJson.configs.length > 1 ? `<p class="subtitle is-6"><code>${appJson.configs[0].altLabel || new URL(appJson.configs[0].url).host}</code></p>` : null
    const appCats = appJson.categories.map(category =>
        `<a href="?categories=${encodeURIComponent(category)}" style="text-decoration: underline;">${getLocalString(allCategories[category])}</a>`).join(', ')
    return `<div class="card mt-4">
            <div class="card-content">
                <div class="is-flex is-justify-content-space-between">
                    <a class="title" href="${appJson.configs[0].url}" target="_blank" style="text-decoration: underline; color: inherit;">${appJson.configs[0].name}</a>
                    ${getIconHTML(appJson.icon, appJson.configs[0].name)}
                </div>

                ${description ? `<p class="subtitle">${description}</p>` : ''}
                ${firstAppLabelElement || ''}
                <a class="button is-primary" href="obtainium://app/${encodeURIComponent(getAppConfigString(appJson, 0))}">
                    ${getString('addToObtainium')}
                </a>
                <a class="button is-secondary" href="javascript:void(0);" onclick="copyAppToClipboard('${appIndex}', 0)">
                    ${getString('copyAppConfig')}
                </a>
                <p class="is-size-7 mt-4" style="color: #555;">${getString('categories')}: ${appCats}</p>
                ${appJson.configs.length == 1 ? '' : `<hr class="is-divider"><p class="title is-5">${getString('altConfigs')}</p>
                <ul>${appJson.configs.slice(1).map((cfg, ind) => {
        return `
                    <li><div class="is-half is-flex is-align-items-center">
                        <p><code>${cfg.altLabel || new URL(cfg.url).host}</code> - <strong>${cfg.name}</strong></p>
                            <div class="mx-5">
                                <a class="button is-primary is-small" href="obtainium://app/${encodeURIComponent(getAppConfigString(appJson, ind + 1))}">
                                    ${getString('addToObtainium')}
                                </a>
                                <a class="button is-secondary is-small" href="javascript:void(0);" onclick="copyAppToClipboard('${appIndex}', ${ind + 1})">
                                    ${getString('copyAppConfig')}
                                </a>
                            </div>
                        </div></li>`}).join('<br/>')}
                </ul>`}
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
    data.selectedApps = appsJson
    if (appsJson.length > 0) {
        return appsJson.sort((a, b) => a.configs[0].name.localeCompare(b.configs[0].name)).map((appJson, appIndex) => getAppEntryHTML(appJson, appIndex, allCategories)).join('\n')
    } else {
        return '<strong>No Apps Found!</strong>'
    }
}

function render() {
    let selectedCategories = ((new URLSearchParams(window.location.search)).get('categories') || '').split(',').filter(c => c.trim())
    if (!selectedCategories || selectedCategories.length == 0) {
        selectedCategories = Object.keys(data.categories)
    }
    document.querySelector('#categories').innerHTML = getCategoriesSelectorHTML(data.apps, data.categories, selectedCategories)
    document.querySelector('#apps').innerHTML = getAppEntriesHTML(data.apps, data.categories, selectedCategories)
    document.querySelector('#title').innerHTML = getString('title')
    document.querySelector('#subtitle').innerHTML = getString('subtitle')
    document.querySelector('#request-apps').innerHTML = getString('requestAppsButton')
    document.querySelector('#modal-title').innerHTML = getString('modalTitle')
    document.querySelector('#modal-body-1').innerHTML = getString('modalBody1')
    document.querySelector('#modal-body-2').innerHTML = getString('modalBody2')
    document.querySelector('#modal-button').innerHTML = getString('modalButtonText') + " →"
}

function toggleModal() {
    const modal = document.getElementById('infoModal');
    modal.classList.toggle('is-active');
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
