from SPARQLWrapper import SPARQLWrapper, JSON
import pandas as pd
import json

sparql = SPARQLWrapper("http://sparql.archives-ouvertes.fr/sparql")
sparql.setReturnFormat(JSON)
sparql.setTimeout(10000000)

pd.set_option('display.max_colwidth', None)

def execute(query):
    queryString = """
        prefix hal:	<http://data.archives-ouvertes.fr/schema/>
        prefix vcard2006: <http://www.w3.org/2006/vcard/ns#>
        prefix ns8:	<http://fr.dbpedia.org/resource/>
        prefix org: <http://www.w3.org/ns/org#>
        prefix skos: <http://www.w3.org/2004/02/skos/core#>
        prefix dcterms: <http://purl.org/dc/terms/>
        prefix fabio: <http://purl.org/spar/fabio/>
        prefix ore:	<http://www.openarchives.org/ore/terms/>
        %s
        """ % query
    sparql.setQuery(queryString)
    response = sparql.query().convert()
    df = pd.json_normalize(response['results']['bindings'])
    filter_col = [col for col in df if not col.endswith(('.type', '.datatype'))]
    return df[filter_col]

def save_data(authors):
    mode = 'w'
    for row in authors.values.tolist():
        authorId = row[0]

        limit = 10000
        offset = 0
        result = execute( query_data.format(authorId, limit, offset) ).fillna('')
        while len(result):
            header = False if mode == 'a' else list(result.columns)
            result.sort_values(['author.value', 'issuedAt.value'], axis = 0, ascending = True,
                            inplace = True, na_position ='last')
            result.to_csv('static/data.csv', sep=',', index=False, header=header, mode=mode)
            mode = 'a'
            offset += limit
            result = execute( query_data.format( authorId, limit, offset) ) # .fillna('0')

def group_data():
    data = pd.read_csv('static/data.csv').fillna('')

    byAuthorDict = {}
    for row in data.values.tolist():
        authorURI = row[0]
        year, mont, date = row[4].split('-')
        country = row[7]

        if authorURI not in byAuthorDict:
            byAuthorDict[ authorURI ] = {}

        if year not in byAuthorDict[ authorURI ]:
            byAuthorDict[ authorURI ][ year ] = {}

        if country not in byAuthorDict[ authorURI ][ year ]:
            byAuthorDict[ authorURI ][ year ][ country ] = []

        byAuthorDict[ authorURI ][ year ][ country ].append({
            # 'author': row[0],
            'docURI': row[1],
            'docTitle': row[2],
            'versionOf': row[3],
            'issuedAt': row[4],
            'lab': row[5],
            'labName': row[6],
            'country': row[7],
            'availableAt': row[8],
            'name1': row[9],
            'name2': row[10],
            'adress': row[11],
        })
    # byAuthorDict

    byAuthorList = []
    for authorURI in byAuthorDict:
        names = set()

        authorData = []
        for year in byAuthorDict[ authorURI ]:
            yearData = []
            for country in byAuthorDict[ authorURI ][ year ]:
                docs = []
                for doc in byAuthorDict[ authorURI ][ year ][ country ]:
                    if doc['name1']:
                        names.add(doc['name1'])
                    if doc['name2']:
                        names.add(doc['name2'])

                    docs.append( {k:doc[k] for k in doc if k not in ['name1', 'name2']} )

                yearData.append({ 'country': country,
                    'docs': docs
                })

            authorData.append({ 'year': year,
                'byCountry': yearData
            })

        byAuthorList.append({ 'authorURI': authorURI, # .replace("https://data.archives-ouvertes.fr/author/", ""),
            'name': list(names)[0] if len(names) == 1 else list(names),
            'byYear': authorData
        })

    with open('static/data.json', 'w', encoding='utf-8') as f:
        json.dump(byAuthorList, f, ensure_ascii=False, indent=2)

def by_author_dict(data, authors = [], countries = [], years = []):
    byAuthorDict = {}
    for row in data.values.tolist():
        authorURI = row[0]
        year, mont, date = row[4].split('-')
        country = row[7]

        if isinstance(authors, list) and len(authors) and authorURI not in authors:
            continue
        if isinstance(years, list) and len(years) and year not in years:
            continue
        if isinstance(countries, list) and len(countries) and country not in countries:
            continue

        if authorURI not in byAuthorDict:
            byAuthorDict[ authorURI ] = {}

        if year not in byAuthorDict[ authorURI ]:
            byAuthorDict[ authorURI ][ year ] = {}

        if country not in byAuthorDict[ authorURI ][ year ]:
            byAuthorDict[ authorURI ][ year ][ country ] = []

        byAuthorDict[ authorURI ][ year ][ country ].append({
            # 'author': row[0],
            'docURI': row[1],
            'docTitle': row[2],
            'versionOf': row[3],
            'issuedAt': row[4],
            'lab': row[5],
            'labName': row[6],
            'country': row[7],
            'availableAt': row[8],
            'name1': row[9],
            'name2': row[10],
            'adress': row[11],
        })
    return byAuthorDict

def by_author_list(byAuthorDict):
    byAuthorList = []
    for authorURI in byAuthorDict:
        names = set()

        authorData = []
        for year in byAuthorDict[ authorURI ]:
            yearData = []
            for country in byAuthorDict[ authorURI ][ year ]:
                docs = []
                for doc in byAuthorDict[ authorURI ][ year ][ country ]:
                    if doc['name1']:
                        names.add(doc['name1'])
                    if doc['name2']:
                        names.add(doc['name2'])

                    docs.append( {k:doc[k] for k in doc if k not in ['name1', 'name2']} )

                yearData.append({ 'country': country,
                    'docs': docs
                })

            authorData.append({ 'year': year,
                'byCountry': yearData
            })

        byAuthorList.append({ 'authorURI': authorURI, # .replace("https://data.archives-ouvertes.fr/author/", ""),
            'name': list(names)[0] if len(names) == 1 else list(names),
            'byYear': authorData
        })
    return byAuthorList

def generate_sankey(byAuthorList):
    index = -1
    nodes = []
    links = []
    nodesMap = {}

    for author in byAuthorList:
        name = author['name']
        if isinstance(name, list):
            name = '; '.join(name)
        
        index += 1
        nodes.append({ 'node': index, 'name': name })
        authIndex = index

        authorData = author['byYear']
        for i in range(len(authorData)):
            if i == 0:
                year = authorData[i]['year']
                byCountry = authorData[i]['byCountry']

                for countryData in byCountry:
                    index += 1

                    currNodeKey = year + countryData['country']

                    if currNodeKey not in nodesMap:
                        nodes.append({ 'node': index, 'year': year, 'country': countryData['country'] })
                        nodesMap[ currNodeKey ] = index

                    links.append({
                        'source': authIndex,
                        'target': nodesMap[ currNodeKey ],
                        'value': len(countryData['docs']),
                        'publications': countryData['docs'],
                        'author': name
                    })
            else:
                prevYear = authorData[i-1]['year']
                currYear = authorData[i]['year']
                for prevCountryData in authorData[i-1]['byCountry']:
                    for currCountryData in authorData[i]['byCountry']:

                        prevNodeKey = prevYear + prevCountryData['country']
                        currNodeKey = currYear + currCountryData['country']

                        if prevNodeKey == currNodeKey:
                            continue

                        if prevNodeKey not in nodesMap:
                            index += 1
                            nodes.append({ 'node': index, 'year': prevYear, 'country': prevCountryData['country'] })
                            nodesMap[ prevNodeKey ] = index

                        if currNodeKey not in nodesMap:
                            index += 1
                            nodes.append({ 'node': index, 'year': currYear, 'country': currCountryData['country'] })
                            nodesMap[ currNodeKey ] = index

                        links.append({
                            'source': nodesMap[ prevNodeKey ],
                            'target': nodesMap[ currNodeKey ],
                            'value': len(currCountryData['docs']),
                            'publications': currCountryData['docs'],
                            'author': name
                        })

    with open('static/sankey-formatted.json', 'w', encoding='utf-8') as f:
        json.dump({'nodes': nodes, 'links': links}, f, ensure_ascii=False, indent=2)

query_authors = """
    select distinct ?author
        # concat(str(?nameAgg), '') as ?nameAgg 
        # concat(str(?nameAuth), '') as ?nameAuth 
        count(distinct ?country) as ?count
    where {{
        ?doc dcterms:creator [ hal:person ?authorURI; hal:structure ?lab ].
        ?lab vcard2006:country-name ?country.
        optional {{ ?authorURI ore:isAggregatedBy ?authorAgg optional {{ ?authorAgg foaf:name ?nameAgg }} }}
        # optional {{ ?authorURI foaf:name ?nameAuth }}
        bind( if(bound(?authorAgg), ?authorAgg, ?authorURI ) as ?author )
        # filter(bound(?nameAgg) or bound(?nameAuth))
    }}
    group by ?author
    having (count(distinct ?country) > {0})
    limit {1} offset {2}
    """

query_data = """
    select distinct
        ?author
        ?doc 
            str(?title) as ?title 
            str(?versionOf) as ?versionOf 
            xsd:date(?issued) as ?issuedAt 
        ?lab ?labName 
        replace(str(?country), 'http://fr.dbpedia.org/resource/', '') AS ?country 
        concat(str(xsd:date(?available)), '') as ?availableAt
        concat(str(?nameAgg), '') as ?nameAgg 
        concat(str(?nameAuth), '') as ?nameAuth 
        concat(str(?adress), '') as ?adress 
    where {{
        ?doc dcterms:issued ?issued;
            dcterms:creator [ hal:person ?authorURI; hal:structure ?lab ].
            optional {{ ?doc dcterms:available ?available }}
            optional {{ ?doc dcterms:title ?title }}
            optional {{ ?doc dcterms:isVersionOf ?versionOf }}
        ?lab skos:prefLabel ?labName;
            vcard2006:country-name ?country.
            optional {{ ?lab org:siteAddress ?adress }}
        optional {{ ?authorURI ore:isAggregatedBy ?authorAgg optional {{ ?authorAgg foaf:name ?nameAgg }} }}
        optional {{ ?authorURI foaf:name ?nameAuth }}
        bind( if(bound(?authorAgg), ?authorAgg, ?authorURI ) as ?author )
        filter(bound(?nameAgg) or bound(?nameAuth))

        filter( ?authorURI = <{0}> )
    }}
    limit {1} offset {2}
    """