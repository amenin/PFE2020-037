/**

**/

const port = 8080

const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const datatools = require('./modules/datatools')

const datafiletimeout = 1296000000;
const datadir = 'data/';
const datafile = {
    'queries': datadir + 'queries.json',
    'authors': datadir + 'authors.json',
    'coauthors': datadir + 'coauthors.json'
}

const cachefile = datadir + 'cache/';

// default variables for testing
const hal_uri = "http://sparql.archives-ouvertes.fr/sparql"
const lab = "I3S";

/**
 * HTTP node server
 * Browser form send HTTP request to this node server
 * Send query to SPARQL endpoint and perform transformation 
 * 
 */
const app = express()

// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(express.static('public'))

// index page 
app.get('/', function (req, res) {
    let data = {};
    Object.keys(datafile).forEach(key => {
        if ( data[key] ) return;
        try {
            if (fs.existsSync(datafile[key])) {
                const stats = fs.statSync(datafile[key]);
                if (key == 'queries' || (new Date().getTime() - stats.mtimeMs) < datafiletimeout) {
                    let rawdata = fs.readFileSync(datafile[key]);
                    data[key] = JSON.parse(rawdata);
                }
            }
        } catch (e) {
            throw e;
        }

        try {
            if (!data[key]) {
                let query = data.queries.prefixes;
                if (key == 'authors'){
                    query += data.queries.query_authors.replace("$lab", lab)
                    let authors = datatools.sparqlQuery(query, hal_uri);
                    try {
                        data[key] = JSON.parse(authors).results.bindings; // write results on file 'authors'
                        let docs = {}
                        datatools.getData(docs, data.queries, data[key].map(d => d.uri.value))
                        let coauthors = datatools.getCoauthorsList(docs)

                        // save files to cache
                        fs.writeFileSync(datadir + 'authors.json', JSON.stringify(data[key]))
                        fs.writeFileSync(datadir + 'docs.json', JSON.stringify(docs))
                        fs.writeFileSync(datadir + 'coauthors.json', JSON.stringify(coauthors))

                        // save to array to send to page
                        data['coauthors'] = coauthors
                    } catch (e) {
                        console.log(e)
                    }
                } 
            } 
        } catch (e) {
            throw e;
        }
    })
    
    res.render('index', { data: data });
})

// About page 
app.get('/about', function (req, res) {
    res.render("pages/about");
})

app.post('/get_docs', function(req, res) {
    let input_text = '';    

    req.on('data', function(value) {
        input_text += value;
    })

    req.on('end', function(){
        let data = JSON.parse(input_text)
        // console.log(data)

        let docs = null;
        const docsfile = datadir + 'docs.json'
        try{
            if (fs.existsSync(docsfile)) {
                const stats = fs.statSync(docsfile);
                if ((new Date().getTime() - stats.mtimeMs) < datafiletimeout) {
                    let rawdata = fs.readFileSync(docsfile);
                    docs = JSON.parse(rawdata);
                }
            }
        } catch(e) {
            // send error back to client
            res.writeHeader(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            res.write(e, "utf-8");
        }

        try {
            let result = {}
            if ( docs ){
                // verify for which authors we already have the data
                let keys = []
                data.authors.forEach(author => {
                    if (!Object.keys(docs).includes(author.uri)) {
                        keys.push(author.uri)
                    } 
                })

                // retrieve docs for authors for whom we don't have data
                if (keys.length) {
                    console.log('Retrieving docs for ' + keys.length + ' authors...')
                    try {
                        let queries = fs.readFileSync(datadir + 'queries.json')    
                        queries = JSON.parse(queries)
                        datatools.getData(docs, queries, keys)
                        fs.writeFileSync(datadir + 'docs.json', JSON.stringify(docs))
                    } catch (e) {
                        // send error back to client
                        res.writeHeader(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
                        res.write(e, "utf-8");
                    }
                } 

                // filter the docs to keep only the ones for the selected authors
                data.authors.forEach(author => {
                    result[author.uri] = docs[author.uri]
                })

               
                result = datatools.transformData(result, data.authors)
            } 

            // send result back to client: HTML + JS graphic specification
            res.writeHeader(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.write(JSON.stringify(result), "utf-8");

            
        } catch(e) {
            console.log("Error", e)
            // send error back to client
            res.writeHeader(400, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            res.write(e, "utf-8");
        }

        res.end()
    })
})

app.listen(port, () => console.log(`Server started at port ${port}.`))

