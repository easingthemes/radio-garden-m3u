const fs = require('fs');
const fetch = require('node-fetch');

const { RESULTS_FILENAME, RESULTS_DIR } = require('./config');
const { URL_PLACE, PLACE_EMPTY } = require('./constants');


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
                    return resolve(PLACE_EMPTY);
                }
            })
            .then(json => {
                return resolve(extractData(json));
            })
            .catch(err => {
                return resolve(PLACE_EMPTY);
            });
    });
};

const createJsonFile = (data, name) => {
    console.log('FILE: writing JSON file ', name);
    fs.writeFileSync(`${RESULTS_DIR}/${RESULTS_FILENAME}.${name}.json`, JSON.stringify(data, null, 4));
};

module.exports = {
    extractPlaceUrl,
    extractChannels,
    getPlace,
    createJsonFile
};