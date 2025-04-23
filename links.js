const axios = require('axios');
const xml2js = require('xml2js');
const mysql = require('mysql');

const baseURL = 'https://www.shoppster.rs/sitemap/Product-sr-RSD-';

const getLinksFromXML = async (xmlString) => {
  const parser = new xml2js.Parser();
  return new Promise((resolve, reject) => {
    parser.parseString(xmlString, (err, result) => {
      if (err) reject(err);
      const urls = result.urlset.url.map(u => u.loc[0]);
      resolve(urls);
    });
  });
};

const main = async () => {
  const allLinks = [];

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'shoppster'
  });

  for (let i = 0; i < 30; i++) {
    try {
      const response = await axios.get(`${baseURL}${i}.xml`);
      const xmlData = response.data;
      const links = await getLinksFromXML(xmlData);
      allLinks.push(...links);
    } catch (error) {
      console.error(`Failed to fetch or parse sitemap ${i}: ${error}`);
    }
  }

for (const link of allLinks) {
    try {
      await connection.query('INSERT INTO links (url) VALUES (?)', [link]);
    } catch (error) {
      console.error(`Failed to insert link ${link}: ${error}`);
    }
  }
  

  await connection.end();
};

main();