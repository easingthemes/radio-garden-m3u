const fs = require('fs');
const fetch = require('node-fetch');
const URL_PLACES = 'https://radio.garden/api/content/places';
const URL_PLACE = 'https://radio.garden/api/content/place/';
const MP3 = 'http://radio.garden/api/content/listen/';
const extraParam = 'listening-from-radio-garden';
const resultsFile = './radio.garden';

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
                if (resp.ok) {
                    return resp.json();
                } else {
                    reject();
                }
            })
            .then(json => {
                return resolve(extractData(json));
            })
            .catch(err => {
                reject();
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
        fetch(url)
            .then(resp => {
                if (resp.ok) {
                    json.mp3 = removeUrlParam(resp.url, extraParam);
                    return resolve(json);
                } else {
                    json.mp3 = '';
                    reject(json);
                }
                // Skip body (eg toJson()), since it's live stream
            })
            .catch(err => {
                json.mp3 = '';
                reject(json);
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

    fs.writeFileSync(resultsFile + '.m3u', m3u);
};

createJsonFile = (allMp3s) => {
    fs.writeFileSync(resultsFile+ '.json', JSON.stringify(allMp3s, null, 4));
};

function getPlaces(group, max) {
    fetch(URL_PLACES)
        .then(resp => resp.json())
        .then(async (json) => {
            const { list } = json.data.places;
            max = max || list.length / group;
            console.log('PLACES response', list.length);

            const allChannels = await bufferRequests(list, getPlace, extractPlaceUrl, extractChannels, max, group);
            console.log('allChannels', allChannels.length);
            const allMp3s = await bufferRequests(allChannels, getMp3, extractMp3Url, extractMp3Data, max, group);

            createJsonFile(allMp3s);
            createM3uFile(allMp3s);

            console.log('allMp3s: ', allMp3s);
        })
        .catch(error => {
            console.log('PLACES error', error);
        });
}

const bufferRequests = async (list = [], oneRequest, extractUrl, extractData, max = 20, group = 5) => {
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

        await Promise.all(requestBuffer)
            .then(groupResponse => {
                const flattenedArray = [].concat(...groupResponse);
                console.log(i, '. GROUP: ', counter);
                allData.push(...flattenedArray);
            })
            .catch(error => {
                console.log(i, '. GROUP: error ', error);
            });

        requestBuffer.splice(0, requestBuffer.length);
    }

    return allData;
};

function start(group, max) {
    getPlaces(group, max);
}


start(50);