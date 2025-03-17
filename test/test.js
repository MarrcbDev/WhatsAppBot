const SerpApi = require('google-search-results-nodejs');
const search = new SerpApi.GoogleSearch("60dd3b09d55bbd7eb858ded7cd0fd1c724295ecfbc9e94884e2a3203acf992e4");

search.json({
    q: "Taylor Swift",
    location: "United States",
    hl: "en"
}, (data) => {
    console.log(data);
});
