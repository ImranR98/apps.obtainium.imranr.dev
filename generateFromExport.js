const jsonPath = process.argv[2]
const configsPath = `${__dirname}/data/apps`

const fs = require('fs')

const existingAppIds = fs.readdirSync(configsPath).filter(f => f.toLowerCase().endsWith('.json')).map(f => f.slice(0, -5))

const newAppConfigs = JSON.parse(fs.readFileSync(jsonPath).toString()).apps.filter(a => !existingAppIds.includes(a.id))

const finalEntries = newAppConfigs.map(c => {
    return {
        configs: [
            {
                id: c.id,
                url: c.url,
                author: c.author,
                name: c.name,
                additionalSettings: c.additionalSettings
            }
        ],
        icon: null,
        categories: ['other'],
        description: {
            en: null
        }
    }
})

finalEntries.forEach(e => {
    fs.writeFileSync(`${configsPath}/${e.configs[0].id}.json`, JSON.stringify(e, null, '    '))
})