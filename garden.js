const fs = require('fs');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const backupChannels = require('./backup/radio.garden.channels.json');
const URL_PLACES = 'https://radio.garden/api/content/places';
const URL_PLACE = 'https://radio.garden/api/content/place/';
const MP3 = 'http://radio.garden/api/content/listen/';
const extraParam = 'listening-from-radio-garden';
const resultsFile = './radio.garden';

// Max number of cycles
const MAX = null; // set to null to fetch all urls
// Url per cycle
const GROUP = 199;
// Use already downloaded list of places/channels (mp3 list not downloaded yet)
const USE_BACKUP = true; // change to false to fetch new list of channels

const placeDefault =  {
    id: 'ERROR',
    name: 'ERROR',
    slug: 'ERROR',
    website: 'ERROR',
    place: { name: 'ERROR', geo: [] },
    functioning: true,
    secure: false,
    country: {
        name: 'ERROR',
        code: 'ERROR'
    },
    mp3: 'ERROR'
};

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

const removeUrlParam = (url, param) => {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(param);

    return urlObj.toString();
};

const extractPlaceUrl = (list = [], counter) => {
    if (list[counter] && list[counter].id) {
        return URL_PLACE + list[counter].id;
    }

    return null;
};

const extractChannels = (json) => {
    let channels = [];
    let place = {};
    let country = {};

    try {
        channels = json.data.channels.list;
        place = json.data.places.list[0];
        country = json.data.countries.list[0];
    } catch (e) {
        console.log(e);
    }


    return channels.map(channel => {
        return {
            ...channel,
            place: {
                name: place.name,
                geo: place.geo
            },
            country: {
                name: country.name,
                code: country.code
            }
        }
    });
};

const getPlace = (url, item, extractData, counter) => {
    return new Promise((resolve, reject) => {
        fetch(url)
            .then(resp => {
                if (!resp.ok) {
                    console.log('STATUS: ', resp.status, 'URL: ', resp.url);
                }

                if (resp.ok) {
                    return resp.json();
                } else {
                    return resolve(placeDefault);
                }
            })
            .then(json => {
                return resolve(extractData(json));
            })
            .catch(err => {
                return resolve(placeDefault);
            });
    });
};

const extractMp3Url = (list = [], counter) => {
    if (list[counter] && list[counter].id) {
        return MP3 + list[counter].id + '/channel.mp3';
    }

    return null;
};

const extractMp3Data = (data) => {
    return data.url;
};

const getMp3 = (url, json = {}, extractData) => {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();

        fetch(url, { signal: controller.signal })
            .then(resp => {
                if (!resp.ok) {
                    console.log('STATUS: ', resp.status, 'URL: ', resp.url);
                }

                json.mp3 = removeUrlParam(resp.url, extraParam);
                controller.abort();
                return resolve(json);
            })
            .catch(err => {
                json.mp3 = '';
                return resolve(json);
            });
    });
};

const createM3uItem = (country, countryCode, name, place, url) => {
    return `
#EXTINF:-1 radio="true" tvg-logo="" group-title="${country} (${countryCode})",${name} (${place})
${url}
`;
};

createM3uFile = (allMp3s) => {
    const mp3s = allMp3s.map(mp3 => {
        return createM3uItem(mp3.country.name, mp3.country.code, mp3.name, mp3.place.name, mp3.mp3);
    }).join('');

    const m3u = `#EXTM3U
${mp3s}`;
    console.log('FILE: writing m3u file.');
    fs.writeFileSync(resultsFile + '.m3u', m3u);
};

createJsonFile = (data, name) => {
    console.log('FILE: writing JSON file ', name);
    fs.writeFileSync(resultsFile + '.' + name + '.json', JSON.stringify(data, null, 4));
};

function getPlaces(group, max) {
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

            allChannels = allChannels || backupChannels;

            if (allChannels) {
                await handleMp3s(allChannels, max, group);
            }
        })
        .catch(error => {
            console.log('PLACES error', error);
        });
}

function delayedLoop(func, delay = 500, loop = 10) {
    function start(counter) {
        func(counter);

        if (counter < loop) {
            setTimeout(function() {
                counter++;
                start(counter);
            }, delay);
        }
    }

    start(0);
}


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

function start(useBackup, group = GROUP, max = MAX) {
    if (useBackup) {
        handleMp3s(backupChannels, max, group);
    } else {
        getPlaces(group, max);
    }
}

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

start(USE_BACKUP, GROUP);
