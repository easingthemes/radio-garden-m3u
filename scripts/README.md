### 1. Requirements
NodeJS v.10.x or higher. https://nodejs.org/en/download/

### 2. Install dependencies

```
npm i
```

### 3. Update scripts/config.js if needed

```
// START Config_____________________________________________________________
const RESULTS_FILENAME = 'radio.garden';
const RESULTS_DIR = './results';
// Max number of cycles
const MAX_CYCLES = null; // set to null to fetch all urls
// Url per cycle
const GROUP_SIZE = 200;
// Use already downloaded list of places/channels (mp3 list not downloaded yet)
let USE_BACKUP = true; // change to false to fetch new list of channels
// END Config ______________________________________________________________
```

### 4. Run script

```
npm start
```