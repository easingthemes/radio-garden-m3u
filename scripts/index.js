const fetch = require('node-fetch');

const { MAX_CYCLES, GROUP_SIZE, USE_BACKUP, CHANNELS_FILE } = require('./config');
const { URL_PLACES } = require('./constants');

const {
    extractPlaceUrl,
    extractChannels,
    getPlace,
    createJsonFile
} = require('./channels');

const {
    extractMp3Url,
    extractMp3Data,
    getMp3,
    createM3uFile
} = require('./mp3s');

let tmpData = [];

process.stdin.resume();

function exitHandler() {
    createJsonFile(tmpData, 'backup');
    process.exit();
}

process.on('SIGINT', exitHandler);
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);
process.on('uncaughtException', exitHandler);

const getPlaces = (group, max) => {
    fetch(URL_PLACES)
        .then(resp => resp.json())
        .then(async (json) => {
            const { list } = json.data.places;
            max = max || list.length / group;
            console.log('PLACES response', list.length);
            createJsonFile(list, 'places');

            let allChannels;
            try {
                allChannels = await bufferRequests(list, getPlace, extractPlaceUrl, extractChannels, max, group);
                console.log('allChannels', allChannels.length);
                createJsonFile(allChannels, 'channels');
            } catch (e) {
                console.log('ERROR: allChannels ', e);
            }

            allChannels = allChannels || CHANNELS_FILE;

            if (allChannels) {
                await handleMp3s(allChannels, max, group);
            }
        })
        .catch(error => {
            console.log('PLACES error', error);
        });
};

const bufferRequests = async (list = [], oneRequest, extractUrl, extractData, max, group) => {
    let requestBuffer = [];
    let counter = 0;
    let allData = [];

    for (let i = 0; i < max; i++) {
        for (let j = 0; j < group; j++) {
            const url = extractUrl(list, counter);

            if (url) {
                requestBuffer.push(oneRequest(url, list[counter], extractData, counter));
            }

            counter++;
        }

        try {
            if (requestBuffer.length > 0) {
                await Promise.all(requestBuffer)
                     .then(groupResponse => {
                         const flattenedArray = [].concat(...groupResponse);
                         console.log(i, '. GROUP: ', counter);
                         allData.push(...flattenedArray);
                         tmpData.push(...flattenedArray);
                     })
                     .catch(error => {
                         console.log(i, '. GROUP: Promise all catch ', error);
                     });
            }

        } catch (e) {
            console.log(i, '. GROUP: await Promise all catch ', error);
        }

        requestBuffer.splice(0, requestBuffer.length);
    }

    return allData;
};

const handleMp3s = async (channels, max, group) => {
    max = max || channels.length / group;
    try {
        console.log('allMp3s channels: ', channels.length);
        const allMp3s = await bufferRequests(channels, getMp3, extractMp3Url, extractMp3Data, max, group);
        createM3uFile(allMp3s);
        createJsonFile(allMp3s, 'mp3s');
        console.log('allMp3s: ', allMp3s.length);
        process.exit();
    } catch (e) {
        console.log('ERROR: allMp3s ', e);
    }
};

const start = async (useBackup, group = GROUP_SIZE, max = MAX_CYCLES) => {
    if (useBackup) {
        await handleMp3s(CHANNELS_FILE, max, group);
    } else {
        getPlaces(group, max);
    }
};

const init = () => {
    start(USE_BACKUP, GROUP_SIZE);
};

init();
