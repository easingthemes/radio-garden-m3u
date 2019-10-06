const fs = require('fs');
const path = require('path');

// START Config_____________________________________________________________
const RESULTS_FILENAME = 'radio.garden';
const RESULTS_DIR = './results';
// Max number of cycles
const MAX_CYCLES = 3; // set to null to fetch all urls
// Url per cycle
const GROUP_SIZE = 3;
// Use already downloaded list of places/channels (mp3 list not downloaded yet)
let USE_BACKUP = true; // change to false to fetch new list of channels
// END Config ______________________________________________________________


const channelsFilePath = path.resolve(`${RESULTS_DIR}/${RESULTS_FILENAME}.channels.json`);
let CHANNELS_FILE = [];

if (fs.existsSync(channelsFilePath)) {
    CHANNELS_FILE = require(channelsFilePath);
} else {
    // Skip if no backup
    USE_BACKUP = false;
}

module.exports = {
    RESULTS_FILENAME,
    RESULTS_DIR,
    MAX_CYCLES,
    GROUP_SIZE,
    USE_BACKUP,
    CHANNELS_FILE
};
