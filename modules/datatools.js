const hal_uri = "http://sparql.archives-ouvertes.fr/sparql"


//--------------------------------
// to send the query to the sparql endpoint
function prepare(query) {
    query = encodeURIComponent(query);
    query = query.replace(/\%20/g, "+");
    query = query.replace(/\(/g, "%28");
    query = query.replace(/\)/g, "%29");
    return query;
}

function sparqlQuery(query, uri) {
    query = prepare(query);

    // Configurer la requête SPARQL en format http
    var requestType = undefined;

    var httpquery = uri + "?query=";
    httpquery = httpquery + query;
    httpquery = httpquery + "&format=application%2Fsparql-results%2Bjson";

    var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
    var xmlhttpquery = new XMLHttpRequest();
    if (requestType === undefined)
        xmlhttpquery.open("GET", httpquery, false);
    else
        xmlhttpquery.open(requestType, httpquery, false);
    //xmlhttpquery.setRequestHeader("Accept", "application/sparql-results+json");
    xmlhttpquery.send();
    return xmlhttpquery.responseText;
}

function getData (docs, queries, authors) {
    authors_list = Object.keys(docs)
    let query = queries.prefixes + queries.query_docs;
    authors.forEach(author => {
        let offset = 0

        if (author in authors_list) return;
        authors_list.push(author)
        docs[author] = []
        console.log('author', author)

        let res = sparqlQuery(query.replace('$uri', author).replace('$offset', offset), hal_uri)
        try {
            res = JSON.parse(res)
        } catch (e) {
            console.log(res)
        }
        let bindings = res.results.bindings

        while ( bindings.length ) {
            docs[author] = docs[author].concat(bindings)

            offset += 10000;
            res = sparqlQuery(query.replace('$uri', author).replace('$offset', offset), hal_uri)
            try {
                res = JSON.parse(res)
                bindings = res.results.bindings
            } catch (e) {
                console.log(res)
            }
        }
    });
}

function getCoauthorsList(docs) {
    coauthors = {}
    Object.keys(docs).forEach(key => {
        coauthors[key] = []
        docs[key].forEach(doc => {
            let authorsList = doc.authorList.value.split('&&')
            authorsList.forEach(value => {
                let uri = value.split('&')[1],
                    name = value.split('&')[0];

                if (uri === key || coauthors[key].findIndex(d => d.uri === uri) > -1) return;

                coauthors[key].push({'name': name, 'uri': uri})
            })
        })
    })
    return coauthors
}

function transformData(data, authors_list) {
    const docs = [],
        links = [];

    authors_list.forEach(author => {
        
        data[author.uri].forEach(item => {
            let authorsList = item.authorList.value.split('&&').map(d => { return {'name': d.split('&')[0], 'uri': d.split('&')[1]}}),
                year = item.issuedAt.value.split('-')[0];

            docs.push({
                'authorURI': author.uri,
                'authorName': item.name.value,
                'docURI': item.doc.value,
                'docTitle': item.title.value,
                'versionOf': item.versionOf.value,
                'pubDate': item.issuedAt.value,
                'pubYear': year,
                'lab': item.lab.value,
                'labName': item.labName.value,
                'docType': item.typeLabel.value,
                'docTypeCode': item.typeCode.value,
                'country': item.country.value,
                'address': item.address.value,
                'citation': item.citation.value.replace(/--/g, ','),
                'authorsList': authorsList,
                'hal': item.hal.value
            })

            authorsList.filter(d => authors_list.map(e => e.name).includes(d.name)).forEach(coauthor => {
                if (coauthor.name === author.name) return

                let link = {'source': {'name': item.name.value, 'uri': author.uri}, 'target': coauthor, 'year': year}
                
                let index = links.findIndex(e => e.source.name === author.name && e.target.name === coauthor.name && e.year === year)
                if (index == -1)
                    links.push(link)
            })
        })
    })

    return {'docs': docs, 'links': links}

}

module.exports = { getData, sparqlQuery, getCoauthorsList, transformData }