const fs = require('fs');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');

const { RESULTS_FILENAME, RESULTS_DIR } = require('./config');
const { URL_MP3, URL_PARAM } = require('./constants');

const removeUrlParam = (url, param) => {
    const urlObj = new URL(url);
    urlObj.searchParams.delete(param);

    return urlObj.toString();
};

const extractMp3Url = (list = [], counter) => {
    if (list[counter] && list[counter].id) {
        return URL_MP3 + list[counter].id + '/channel.mp3';
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

                json.mp3 = removeUrlParam(resp.url, URL_PARAM);
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

const createM3uFile = (allMp3s) => {
    const mp3s = allMp3s.map(mp3 => {
        return createM3uItem(mp3.country.name, mp3.country.code, mp3.name, mp3.place.name, mp3.mp3);
    }).join('');

    const m3u = `#EXTM3U
${mp3s}`;
    console.log('FILE: writing m3u file.');
    fs.writeFileSync(`${RESULTS_DIR}/${RESULTS_FILENAME}.m3u`, m3u);
};

module.exports = {
    extractMp3Url,
    extractMp3Data,
    getMp3,
    createM3uFile
};