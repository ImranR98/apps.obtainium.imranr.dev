const fs = require('fs')

const buildData = () => {
    const strings = JSON.parse(fs.readFileSync(__dirname + '/data/strings.json').toString())
    const categories = JSON.parse(fs.readFileSync(__dirname + '/data/categories.json').toString())
    const apps = fs.readdirSync(__dirname + '/data/apps')
        .filter(f => f.endsWith('.json'))
        .map(f => JSON.parse(fs.readFileSync(__dirname + '/data/apps/' + f).toString()))
    apps.forEach(a => a.configs.forEach(c => JSON.parse(c.additionalSettings || '{}')))
    fs.writeFileSync(__dirname + '/data.json', JSON.stringify({ strings, categories, apps }, null, '    '))
}

const deBuildData = () => {
    const data = JSON.parse(fs.readFileSync(__dirname + '/data.json').toString())
    let i = 1;
    data.apps.forEach(app => {
        const id = app.configs[0].id
        fs.writeFileSync(__dirname + '/data/apps/' + id + '.json', JSON.stringify(app, null, '    '))
    })
    fs.writeFileSync(__dirname + '/data/strings.json', JSON.stringify(data.strings, null, '    '))
    fs.writeFileSync(__dirname + '/data/categories.json', JSON.stringify(data.categories, null, '    '))
}

buildData()
