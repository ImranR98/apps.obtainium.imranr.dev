// Generate several hundred mock app JSONs and place them in apps/temp (ignored by Git and Docker)
// For local use with benchmark.sh

import fs from 'fs'
import path from 'path'

const templateApp = {
    "configs": [
        {
            "id": "org.example.app",
            "url": "https://example.org/author/name",
            "author": "AppDev",
            "name": "AppName",
            "additionalSettings": "{\"includePrereleases\":false,\"fallbackToOlderReleases\":true,\"filterReleaseTitlesByRegEx\":\"\",\"filterReleaseNotesByRegEx\":\"\",\"verifyLatestTag\":false,\"dontSortReleasesList\":false,\"useLatestAssetDateAsReleaseDate\":false,\"trackOnly\":false,\"versionExtractionRegEx\":\"\",\"matchGroupToUse\":\"\",\"versionDetection\":false,\"releaseDateAsVersion\":true,\"useVersionCodeAsOSVersion\":false,\"apkFilterRegEx\":\"Monero\",\"invertAPKFilter\":false,\"autoApkFilterByArch\":true,\"appName\":\"\",\"shizukuPretendToBeGooglePlay\":false,\"exemptFromBackgroundUpdates\":false,\"skipUpdateNotifications\":false,\"about\":\"\"}"
        }
    ],
    "categories": [
        "miscellaneous"
    ],
    "description": {
        "en": "Example app"
    }
}

const generateRandomVariant = () => {
    const myApp = structuredClone(templateApp)
    for (let i = 0; i < Math.floor(Math.random() * 4); i++) {
        myApp.configs.push(structuredClone(myApp.configs[0]))
    }
    for (let i = 0; i < myApp.configs.length; i++) {
        const rand = Math.floor(Math.random() * 100000)
        myApp.configs[i].id += `.${rand}`
        myApp.configs[i].name += ` ${rand}`
    }
    return myApp
}

const total = process.argv[2] ? Number.parseInt(process.argv[2]) : 5000

for (let i = 0; i < total; i++) {
    const myApp = generateRandomVariant()
    fs.mkdirSync(path.resolve('./public/data/apps/mock/'), { recursive: true })
    fs.writeFileSync(path.resolve('./public/data/apps/mock/', `${myApp.configs[0].id}.json`), JSON.stringify(myApp, null, '    '))
}