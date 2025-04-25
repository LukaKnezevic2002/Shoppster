//import modules
const cheerio = require('cheerio')
const request = require('request')
var sql = require('mysql');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

var conn = sql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "shoppster"
});

conn.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

async function scrapeData(url) {
    return new Promise((resolve, reject) => {
        const options = {
            url: url,
            headers: {
                'User-Agent': 'Googlebot/2.1 (+http://www.googlebot.com/bot.html)'
            }
        };
        request(options, async function (error, response, html) {
            if (!error && response.statusCode == 200) {
                var $ = cheerio.load(html)

                try {
                    let status = 'ok';
                    var title = $('.product__name') ? $('.product__name').text() : '';
                    var id = $(".product__code") ? $(".product__code").text() : '';
                    var brend = $('.product__brand') ? $('.product__brand').text() : '';
                    var oldPrice = $('.price__value--normal.price__value--normal--discount').length > 0 ? $('.price__value--normal.price__value--normal--discount').text().replace(/\./g, '') : 0;
                    oldPrice = parseInt(oldPrice, 10);
                    var price = $('.price__value--normal') ? $('.price__value--normal').text().replace(/[().]/g, '') : 0;

                    let categories = [];
                    for (let i = 2; i <= 6; i++) {
                        let selector = $('.d-inline li:nth-child(' + i + ') a');
                        if (selector.length) {
                            categories.push({
                                name: selector.text(),
                                link: "https://www.shoppster.rs" + selector.attr('href')
                            });
                        }
                    }

                    let colors = [];
                    for (let i = 1; i <= 5; i++) {
                        let selector = $(".variant-selector__colors .variant-selector__color-outer:nth-child(" + i + ") span");
                        if (selector.length > 0 && selector.attr('title')) {
                            colors.push(selector.attr('title'));
                        }
                    }

                    var descr = $('.description__text').html() ? $('.description__text').html().replace(/<[^>]*>/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() : '';
                    var imageUrl = $(".product__main-media img") ? $(".product__main-media img").attr('src') : '';
                    var imageName = id + ".avif";

                    if (imageUrl && id) {
                        var imagePath = path.resolve(__dirname, 'images', `${id}.avif`);
                    
                        if (!fs.existsSync(imagePath)) {
                            request(imageUrl).pipe(fs.createWriteStream(imagePath))
                                .on('close', () => console.log(`Image downloaded and saved as ${id}.avif`));
                        } else {
                            //console.log(`File ${id}.avif already exists.`);
                        }
                    }

                    resolve({
                        status,
                        title,
                        brend,
                        price,
                        oldPrice,
                        colors,
                        categories,
                        descr,
                        imageName
                    });

                } catch (err) {
                    reject({
                        status: 'offline',
                        title: '',
                        brend: '',
                        price: '',
                        oldPrice: '',
                        colors: [],
                        categories: [],
                        descr: '',
                        imageName: ''
                    });
                }

            } else {
                resolve({
                    status: 'offline',
                    title: '',
                    brend: '',
                    price: '',
                    oldPrice: '',
                    colors: [],
                    categories: [],
                    descr: '',
                    imageName: ''
                });
            }
        });
    });
}

//scrapeData("https://www.shoppster.rs/p/0014084")

async function getLink() {
    let sqlSelectQuery = "SELECT * FROM products WHERE status = '' LIMIT 200";
    conn.query(sqlSelectQuery, async (err, results) => {
        if (err) {
            console.error(err);
        } else {
            const promises = results.map(row => {
                const url = row.url;
                const id = row.id;
                return scrapeData(url)

                    .then(data => {
                        let updateQuery = `UPDATE products SET status = ${conn.escape(data.status)}, title = ${conn.escape(data.title)}, brend = ${conn.escape(data.brend)}, price = ${conn.escape(data.price)}, oldPrice = ${conn.escape(data.oldPrice)}, colors = ${conn.escape(JSON.stringify(data.colors))}, categories = ${conn.escape(JSON.stringify(data.categories))}, descr = ${conn.escape(data.descr)}, imageName = ${conn.escape(data.imageName)} WHERE id = ${id}`;                    
                        return new Promise((resolve, reject) => {
                            conn.query(updateQuery, (updateErr, updateResults) => {
                                if (updateErr) {
                                    console.error(updateErr);
                                    reject(updateErr);
                                } else {
                                    console.log("Record updated!");
                                    resolve(updateResults);
                                }
                            });
                        });
                    })
                    .catch(error => {
                        console.error(`Error scraping URL ${row.url}:`, error);
                    });
            });

            Promise.all(promises).then(() => {
                console.log('Batch of 100 has been processed');
                getLink();
            }).catch(error => {
                console.error('An error occurred with Promise.all:', error);
            });
        }
    });
}

getLink();
