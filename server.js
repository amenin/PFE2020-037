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
    // 'institutions': datadir + 'institution_data.json',
    'authors': datadir + 'authors.json',
    'coauthors': datadir + 'coauthors.json'
}

let queries = {}
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
    const data = {};

    const authorsfile = datadir + 'authors.json';
    try {
        // if authors file exists and it is not too old (15 days) then load the files from cache
        if (fs.existsSync(authorsfile) && (new Date().getTime() - fs.statSync(authorsfile).mtimeMs) < datafiletimeout) {
            Object.keys(datafile).forEach(key => {
                let rawdata = fs.readFileSync(datafile[key]);
                data[key] = JSON.parse(rawdata);
            })
        } else { // retrieve data from sparql endpoint
            // const queries = loadFile(datadir + 'queries.json')
            let query = queries.prefixes + queries.query_authors.replace("$lab", lab)
            // retrieve a list of 100 authors to begin the exploration
            let authors = datatools.sparqlQuery(query, hal_uri);
            data.authors = JSON.parse(authors).results.bindings.map(d => {
                return {
                    'name': d.name.value,
                    'uri': d.uri.value
                }
            }); 
            // retrieve list of documents for those authors
            let docs = {}
            datatools.getData(docs, queries, data.authors.map(d => d.uri))
            data.coauthors = datatools.getCoauthorsList(docs) // extract coauthors from the documents of those 100 authors

            // save files to further use
            fs.writeFileSync(datadir + 'authors.json', JSON.stringify(data.authors))
            fs.writeFileSync(datadir + 'docs.json', JSON.stringify(docs))
            fs.writeFileSync(datadir + 'coauthors.json', JSON.stringify(data.coauthors))
        }
    } catch(e) {
        console.log(e)
    }
    
    res.render('index', { data: data });
})

// About page 
app.get('/about', function (req, res) {
    res.render("pages/about");
})

app.post('/get_docs', async (req, res) => {
    let input_text = '';    

    req.on('data', function(value) {
        input_text += value;
    })

    req.on('end', function(){        
        try {
            let result = {}
            let data = JSON.parse(input_text)
            let docs = loadFile(datadir + 'docs.json')

            if ( Object.keys(docs).length ){
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
                    // let queries = loadFile(datadir + 'queries.json')
                    datatools.getData(docs, queries, keys)
                    fs.writeFileSync(datadir + 'docs.json', JSON.stringify(docs, null, 4))
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

app.post('/get_author_data', async (req, res) => {
    let input_text = '';

    req.on('data', function(value) {
        input_text += value;
    })

    req.on('end', function(){
        try {
            let result = {}
            let data = JSON.parse(input_text)
            let docs = loadFile(datadir + 'docs.json')

            if ( Object.keys(docs).length ) {
                // let queries = loadFile(datadir + 'queries.json');
                let author_list = fs.readFileSync(datadir + 'authors.json')    
                result.authors = JSON.parse(author_list)
                if (!Object.keys(result.authors).includes(data.author.uri)) { // if the author does not exits in the pre-loaded data then retrieve data from database
                    result.authors.push(data.author)
                    
                    datatools.getData(docs, queries, [data.author.uri])
                    result.coauthors = datatools.getCoauthorsList(docs)

                    // save files to cache
                    fs.writeFileSync(datadir + 'authors.json', JSON.stringify(result.authors, null, 4))
                    fs.writeFileSync(datadir + 'docs.json', JSON.stringify(docs, null, 4))
                    fs.writeFileSync(datadir + 'coauthors.json', JSON.stringify(result.coauthors, null, 4))   
                } else {
                    let coauthors = loadFile(datadir + 'coauthors.json')
                    result.coauthors = JSON.parse(coauthors)
                }
            }

            // send result back to client: HTML + JS graphic specification
            res.writeHeader(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.write(JSON.stringify(result), "utf-8");    

        } catch (e) {
            console.log('Error', e)
            // send error back to client
            res.writeHeader(500, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
            res.write(e, "utf-8");
        }
        res.end()
    })
})

////// help functions ////
function loadFile(filename) {
    
    let filedata = {}
    if (fs.existsSync(filename)) {
        let rawdata = fs.readFileSync(filename);
        filedata = JSON.parse(rawdata);
    }

    return filedata;
}

app.listen(port, () => {
    queries = loadFile(datadir + 'queries.json')
    //--------------------------------------------------------------------------------------
    // the following code was used once to retrieve the hierarchy of institutions from HAL
    // let filename = datadir + 'institution_data.json'
    // let data = loadFile(filename)
    // if ( !Object.keys(data).length ){
        // datatools.getInstitutionHierarchy(queries)
        // fs.writeFileSync(filename, JSON.stringify(data, null, 4))
    // }
    //---------------------------------------------------------------------------------------
    console.log(`Server started at port ${port}.`)
})

