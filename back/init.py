import re
from SPARQLWrapper import SPARQLWrapper, JSON
import pandas as pd
import json

from pandas.tseries import offsets

sparql = SPARQLWrapper("http://sparql.archives-ouvertes.fr/sparql")
sparql.setReturnFormat(JSON)
sparql.setTimeout(1000000)

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
        prefix dc: <http://purl.org/dc/elements/1.1/>
        %s
        """ % query
    sparql.setQuery(queryString)
    response = sparql.query().convert()
    df = pd.json_normalize(response['results']['bindings'])
    filter_col = [col for col in df if not col.endswith(('.type', '.datatype'))]
    return df[filter_col]
    

# def save_data(authors):
#     mode = 'w'
#     limit = 10000
#     for row in authors.values.tolist():
#         authorId = row[0] 
#         offset = 0
        
#         docs = execute( query_data.format(authorId, limit, offset) ).fillna('')
#         coauthors = execute( query_coauthors.format( authorId, limit, offset) ).fillna('')
#         while len(docs) or len(coauthors):
#             offset += limit
#             if (len(docs)):
#                 header = False if mode == 'a' else list(docs.columns)
#                 docs.to_csv('static/data.csv', sep=',', index=False, header=header, mode=mode)
#                 docs = execute( query_data.format( authorId, limit, offset) )

#             if len(coauthors):
#                 header = False if mode == 'a' else list(coauthors.columns)
#                 coauthors.to_csv('static/coauthors.csv', sep=',', index=False, header=header, mode=mode)
#                 coauthors = execute( query_coauthors.format( authorId, limit, offset) )

#             mode = 'a'

def save_data_bis(authors):
    mode = 'w'
    limit = 10000
    index = 0
    authors_list = []
    for row in authors.values.tolist(): # recover the coauthors
        authorId = row[0]
        authorName = row[1] # using the author's name for testing
        print('author', authorName, authorId)
        offset = 0

        if authorId not in authors_list:
            authors_list.append(authorId)  

            docs = execute( query_docs_by_uri.format(authorId, limit, offset) ).fillna('')  
            while len(docs):
                header = False if mode == 'a' else list(docs.columns)
                docs.to_csv('static/docs.csv', sep=',', index=False, header=header, mode=mode)
                
                offset += limit       
                mode = 'a'
                for coauthors_list in docs['authorList.value']:
                    for coauthor in coauthors_list.split('&&'):
                        name, uri = coauthor.split('&')
                        # print(name)
                        if uri in authors_list :
                            continue

                        print(index, 'coauthor', name, uri)
                        
                        co_offset = 0
                        authors_list.append(uri)

                        # print('Searching...')
                        docs = execute( query_docs_by_uri.format(uri, limit, co_offset) )
                        while len(docs):
                            docs.to_csv('static/docs.csv', sep=',', index=False, header=False, mode='a')
                            co_offset += limit
                            docs = execute( query_docs_by_uri.format(uri, limit, co_offset) )

                # coauthors = execute( query_coauthors.format( authorId, limit, offset) )
                docs = execute( query_docs_by_uri.format( authorId, limit, offset) )      
        

        index += 1

def save_author_data(author_uri_list):
    authors_list = []
    limit = 1000
    for uri in author_uri_list:
        

        offset = 0

        if uri in authors_list:
            continue
            
        authors_list.append(uri)

        docs = execute( query_docs_by_uri.format(uri, limit, offset) ).fillna('')  
        while len(docs):
            docs.to_csv('static/docs.csv', sep=',', index=False, header=False, mode='a')
            offset += limit  

            authors_list = save_coauthors_data(authors_list, docs['authorList.value'])
               
            docs = execute( query_docs_by_uri.format( uri, limit, offset) )      

def save_coauthors_data(authors_list, coauthors_list):
    limit = 1000
    for item in coauthors_list:
        for coauthor in item.split('&&'):
            name, uri = coauthor.split('&')

            if uri in authors_list :
                continue
            
            offset = 0
            authors_list.append(uri)

            # print('Searching...')
            docs = execute( query_docs_by_uri.format(uri, limit, offset) )
            while len(docs):
                docs.to_csv('static/docs.csv', sep=',', index=False, header=False, mode='a')
                offset += limit
                docs = execute( query_docs_by_uri.format(uri, limit, offset) )

    return authors_list

def group_data():
    print('Grouping data...')
    
    # docAuthors = by_doc_dict() # recover dictionary with list of authors per document
    data = pd.read_csv('static/docs.csv').fillna('')
    byAuthorDict = {}
    for row in data.values.tolist():
        author = row[2] # author's name because same author has different uris (temporary solution)
        year, mont, date = row[5].split('-')
        docURI = row[1]

        if author not in byAuthorDict:
            byAuthorDict[ author ] = {}

        if year not in byAuthorDict[ author ]:
            byAuthorDict[ author ][ year ] = []

        authorList = list(map(lambda x: {'name': x.split('&')[0], 'id': x.split('&')[1]}, row[13].split('&&')))

        byAuthorDict[ author ][ year ].append({
            'docURI': docURI,
            'authorURI': row[0],
            'authorName': row[2],
            'docTitle': row[3],
            'versionOf': row[4],
            'issuedAt': row[5],
            'lab': row[6],
            'labName': row[7],
            'docTypeURI': row[8],
            'docType': row[16],
            'docTypeCode': row[14],
            'country': row[9],
            'availableAt': row[10],
            'address': row[11],
            'citation': row[12].replace('--', ','),
            'authorsList': authorList
        })

    byAuthorList = by_author_list(byAuthorDict)

    with open('static/data.json', 'w', encoding='utf-8') as f:
        json.dump(byAuthorList, f, ensure_ascii=False, indent=2)

    author_list = pd.read_csv('static/authors_list.csv').fillna('')
    coauthorsDict = coauthors_by_author_dict(author_list, byAuthorDict)
    coauthorsList = coauthors_by_author_list(coauthorsDict)

    with open('static/coauthors.json', 'w', encoding='utf-8') as f:
        json.dump(coauthorsList, f, ensure_ascii=False, indent=2)

def by_author_list(byAuthorDict):
    byAuthorList = []
    for author in byAuthorDict:
        authorURI = set()

        authorData = []
        for year in byAuthorDict[ author ]:
            docs = []
            for doc in byAuthorDict[ author ][ year ]:
                authorURI.add(doc['authorURI'])
                # docs.append(byAuthorDict[ author ][ year ][ docURI ])
                if doc not in docs:
                    docs.append( { k : doc[k] for k in doc } )

            authorData.append({ 'year': year,
                'docs': docs
            })

        byAuthorList.append({ 'authorURI': list(authorURI)[0] if len(authorURI) == 1 else list(authorURI), # .replace("https://data.archives-ouvertes.fr/author/", ""),
            'name': author,
            'byYear': authorData
        })
    return byAuthorList

def coauthors_by_author_dict(authors, byAuthorDict):
    coByAuthorDict = {}
    for row in authors.values.tolist():
        authorName = row[1]

        if authorName not in coByAuthorDict:
            coByAuthorDict[authorName] = {
                'id': row[0],
                'name': authorName
            }

        authorData = byAuthorDict[authorName]
        for year in authorData: 
            for doc in authorData[ year ]:
                for coauthor in doc['authorsList']:
                    name = coauthor['name']
                    if name == authorName or name in coByAuthorDict[authorName]:
                        continue
                    
                    coByAuthorDict[authorName][name] = coauthor['id']

    return coByAuthorDict
        

def coauthors_by_author_list(byAuthorDict):
    byAuthorList = []
    for key, value in byAuthorDict.items():
        coauthorsList = []
        for name, uri in value.items():
            if name in ['name', 'id']:
                continue
            coauthorsList.append({'name': name, 'id': uri})

        byAuthorList.append({
            'id': value['id'],
            'name': value['name'],
            'coauthors': coauthorsList
        })

    return byAuthorList

def by_author_dict(data, authors = [], coauthors = [], years = []):
    docAuthors = by_doc_dict() # recover dictionary with list of authors per document

    byAuthorDict = {}
    for row in data.values.tolist():
        authorURI = row[0]
        year, month, day = row[5].split('-')
        docURI = row[1]

        if (isinstance(authors, list) and len(authors) and authorURI not in authors) or (isinstance(coauthors, list) and len(coauthors) and authorURI not in coauthors):
            continue

        if isinstance(years, list) and len(years) and year not in years:
            continue

        if authorURI not in byAuthorDict:
            byAuthorDict[ authorURI ] = {}

        if year not in byAuthorDict[ authorURI ]:
            byAuthorDict[ authorURI ][ year ] = []

        byAuthorDict[ authorURI ][ year ].append({
            'docURI': docURI,
            'name': row[2],
            'docTitle': row[3],
            'versionOf': row[4],
            'issuedAt': row[5],
            'lab': row[6],
            'labName': row[7],
            'docType': row[8].split('/')[-1],
            'country': row[9],
            'availableAt': row[10],
            'address': row[11],
            'citation': row[12].replace('--', ','),
            'authorsList': docAuthors[docURI]['authors'] if docURI in docAuthors else []
        })
    return byAuthorDict



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

    return {'nodes': nodes, 'links': links}

def generate_sankey_per_year(byAuthorList):
    index = -1
    nodes = []
    links = []
    nodesMap = {}

    for author in byAuthorList:
        name = author['name']
        if isinstance(name, list):
            name = '; '.join(name)

        index += 1
        authIndex = index
        nodes.append({'node': index, 'name': name, 'value': 1})

        authorData = author['byYear']  
        for i in range(len(authorData)):

            currYear = authorData[i]['year']
            currNodeKey = currYear + name
            
            if currNodeKey not in nodesMap:
                index += 1
                nodesMap[ currNodeKey ] = index
                nodes.append({ 
                    'node': index, 
                    'year': authorData[i]['year'] ,
                    'name': name, 
                    'value': len(authorData[i]['docs']),
                    'publications': authorData[i]['docs']
                })

            link = {
                'target': nodesMap[ currNodeKey ],
                'author': name,
                'value': len(authorData[i]['docs'])
            }
            if i == 0:
                link['source'] = authIndex
            else:
                prevYear = authorData[i-1]['year']

                prevNodeKey = prevYear + name
                
                if prevNodeKey == currNodeKey:
                    continue

                link['source'] = nodesMap[ prevNodeKey ]
                
            links.append(link)
 
    with open('static/sankey-formatted.json', 'w', encoding='utf-8') as f:
        json.dump({'nodes': nodes, 'links': links}, f, ensure_ascii=False, indent=2)

    return {'nodes': nodes, 'links': links}

def generate_timeline_data(data):
    docs = []
    links = []
    index = 0

    for author in data:
        name = author['name']
        if isinstance(name, list):
            name = '; '.join(name)

        for yearData in author['byYear']  :
            year = yearData['year']

            for docData in yearData['docs']:
                docs.append(docData)
                docs[index]['year'] = year
                docs[index]['author'] = name
                index += 1
        
                for coauthor in docData['authorsList'] :
                    if coauthor == name:
                        continue
                    
                    link = [{'source': name, 'target': coauthor, 'year': year}]
                    if link in links:
                        continue

                    links.append(link)
 
    with open('static/sankey-formatted.json', 'w', encoding='utf-8') as f:
        json.dump({'docs': docs, 'links': links}, f, ensure_ascii=False, indent=2)

    return {'docs': docs, 'links': links}

def generate_timeline(data, authors = [], years = []):
    docs = []
    links = []
    index = 0
    for row in data.values.tolist():
        authorName = row[1]
       
        if authorName not in authors:
            continue

        for yearData in row[2]:
            year = yearData['year']

            if year not in years:
                continue

            for doc in yearData['docs']:
                docs.append(doc)
                docs[index]['year'] = year
                docs[index]['author'] = authorName
                index += 1

                for coauthor in doc['authorsList']:
                    if coauthor['name'] == authorName or coauthor['name'] not in authors:
                        continue
                    
                    link = {'source': authorName, 'target': coauthor['name'], 'year': year}
                    if link in links:
                        continue

                    links.append(link)
        
    with open('static/timeline_data.json', 'w', encoding='utf-8') as f:
        json.dump({'docs': docs, 'links': links}, f, ensure_ascii=False, indent=2)

    return {'docs': docs, 'links': links}



# query_authors = """
#     select distinct ?author
#         count(distinct ?country) as ?count
#     where {{
#         ?doc dcterms:creator [ hal:person ?author; hal:structure ?lab ].
#         ?lab vcard2006:country-name ?country.
#     }}
#     group by ?author
#     having (count(distinct ?country) > {0})
#     limit {1} offset {2}
#     """

# query_coauthors = """
#     select distinct ?doc (sample(?a1) as ?author) (sample(?n1) as ?author_name) 
#         (group_concat(distinct ?coauthor ; separator = '--') as ?coauthors)
#         # (group_concat(distinct ?coauthor_name ; separator = '--') as ?coauthors_names) 
        
#         where {{
            
#             ?doc dcterms:creator [ hal:person ?a1 ], [ hal:person ?a2 ] .
#             ?a1 foaf:name ?n1 .

#             optional {{ ?a2 ore:isAggregatedBy ?a2Agg optional {{ ?a2Agg foaf:name ?n2Agg }} }}
#             optional {{ ?a2 foaf:name ?n2Auth }}
#             bind( if(bound(?a2Agg), ?a2Agg, ?a2 ) as ?coauthorURI )
#             bind( if(bound(?n2Agg), ?n2Agg, ?n2Auth ) as ?coauthor_name )

#             filter(?a1 = <{0}>)
#             filter(?a1 != ?a2)

#             bind(concat(?coauthor_name, "&", ?coauthorURI) AS ?coauthor)
#         }} 
#     group by ?doc
#     limit {1} offset {2}
# """

# query_docs_by_name = """
#     select distinct
#         ?author
#         ?doc 
#         "{0}" as ?name 
#         str(?title) as ?title 
#         str(?versionOf) as ?versionOf 
#         xsd:date(?issued) as ?issuedAt 
#         ?lab ?labName ?type
#         replace(str(?country), 'http://fr.dbpedia.org/resource/', '') AS ?country 
#         concat(str(xsd:date(?available)), '') as ?availableAt
#         concat(str(?address), '') as ?address 
#         ?citation
#         ?authorList
#         ?typeCode
#         ?typeLabel
#     where {{
#         {{select * where {{
#             ?doc dcterms:issued ?issued;
#                 dcterms:creator [ hal:person ?author; hal:structure ?lab ] ;
#                 dcterms:type ?type ;
#                 dcterms:bibliographicCitation ?c .

#             ?type dc:identifier ?typeCode ; skos:prefLabel ?typeLabel .
#             filter langMatches(lang(?typeLabel), "en")

#             ?author foaf:name "{0}" .

#             optional {{ ?doc dcterms:available ?available }}
#             optional {{ ?doc dcterms:title ?title }}
#             optional {{ ?doc dcterms:isVersionOf ?versionOf }}
#             ?lab skos:prefLabel ?labName;
#             vcard2006:country-name ?country.
#             optional {{ ?lab org:siteAddress ?address }}

#             bind(replace(str(?c),",","--") as ?citation) .
#             }}
#         }}
#         {{ select ?doc (group_concat(?coauthor ; separator="&&") as ?authorList) 
# 	        where {{
#                 ?doc dcterms:creator [ hal:person ?authorURI ] .

#                 optional {{ ?authorURI ore:isAggregatedBy ?coauthorAgg }} 
#                 # optional {{ ?authorAgg foaf:name ?nameAgg }} }}
#                 # optional {{ ?authorURI foaf:name ?nameAuth }}
#                 bind( if(bound(?authorAgg), ?authorAgg, ?authorURI ) as ?coauthorURI )
#                 # bind( if(bound(?nameAgg), ?nameAgg, ?nameAuth ) as ?name )

#                 ?coauthorURI foaf:name ?name .
#                 bind(concat(?name, "&", ?coauthorURI) AS ?coauthor)
# 	        }} 
#             group by ?doc
#         }}
#     }}
#     limit {1} offset {2}
#     """

query_authors = """
    select distinct ?author ?name where {{
        ?doc dcterms:creator [hal:person ?author ; hal:structure ?etab ] .
        ?etab skos:prefLabel ?lab ; skos:altLabel "{0}" .
        ?author foaf:name ?name .

        # optional {{ ?authorURI ore:isAggregatedBy ?authorAgg optional {{ ?authorAgg foaf:name ?nameAgg }} }}
        # optional {{ ?authorURI foaf:name ?nameAuth }}
        # bind( if(bound(?authorAgg), ?authorAgg, ?authorURI ) as ?author )
        # bind( if(bound(?nameAgg), ?nameAgg, ?nameAuth ) as ?name )

    }} limit {1} offset {2}
"""

query_docs_by_uri = """
    select distinct
        ?author
        ?doc 
        ?name
        str(?title) as ?title 
        str(?versionOf) as ?versionOf 
        xsd:date(?issued) as ?issuedAt 
        ?lab ?labName ?type
        replace(str(?country), 'http://fr.dbpedia.org/resource/', '') AS ?country 
        concat(str(xsd:date(?available)), '') as ?availableAt
        concat(str(?address), '') as ?address 
        ?citation
        ?authorList
        ?typeCode
        ?typeLabel
    where {{
        {{select * where {{
            ?doc dcterms:issued ?issued;
                dcterms:creator [ hal:person ?author; hal:structure ?lab ] ;
                dcterms:type ?type ;
                dcterms:bibliographicCitation ?c .

            ?type dc:identifier ?typeCode ; skos:prefLabel ?typeLabel .
            filter langMatches(lang(?typeLabel), "en")

            # optional {{ ?authorURI ore:isAggregatedBy ?authorAgg }} 
            # bind( if(bound(?authorAgg), ?authorAgg, ?authorURI ) as ?author )
            ?author foaf:name ?name .

            optional {{ ?doc dcterms:available ?available }}
            optional {{ ?doc dcterms:title ?title }}
            optional {{ ?doc dcterms:isVersionOf ?versionOf }}
            ?lab skos:prefLabel ?labName;
            vcard2006:country-name ?country.
            optional {{ ?lab org:siteAddress ?address }}

            bind(replace(str(?c),",","--") as ?citation) .
            filter (?author = <{0}>)
            }}
        }}
        {{ select ?doc (group_concat(?coauthor ; separator="&&") as ?authorList) 
	        where {{
                ?doc dcterms:creator [ hal:person ?coauthorURI ] .

                # optional {{ ?coauthorURI ore:isAggregatedBy ?coauthorAgg }} 
                # bind( if(bound(?coauthorAgg), ?coauthorAgg, ?coauthorURI ) as ?coauthorURI )

                ?coauthorURI foaf:name ?name .
                bind(concat(?name, "&", ?coauthorURI) AS ?coauthor)
	        }} 
            group by ?doc
        }}
    }}
    limit {1} offset {2}
    """

query_data = """
    select distinct
        ?author
        ?doc 
        # concat(str(?name), '') as ?name 
            str(?title) as ?title 
            str(?versionOf) as ?versionOf 
            xsd:date(?issued) as ?issuedAt 
        ?lab ?labName ?type
        replace(str(?country), 'http://fr.dbpedia.org/resource/', '') AS ?country 
        concat(str(xsd:date(?available)), '') as ?availableAt
        concat(str(?nameAgg), '') as ?nameAgg 
        concat(str(?nameAuth), '') as ?nameAuth 
        concat(str(?address), '') as ?address 
        ?citation
    where {{
        ?doc dcterms:issued ?issued;
            dcterms:creator [ hal:person ?authorURI; hal:structure ?lab ] ;
            a ?type ;
            dcterms:bibliographicCitation ?c .

        optional {{ ?doc dcterms:available ?available }}
        optional {{ ?doc dcterms:title ?title }}
        optional {{ ?doc dcterms:isVersionOf ?versionOf }}
        ?lab skos:prefLabel ?labName;
        vcard2006:country-name ?country.
        optional {{ ?lab org:siteAddress ?address }}

        optional {{ ?authorURI ore:isAggregatedBy ?authorAgg optional {{ ?authorAgg foaf:name ?nameAgg }} }}
        optional {{ ?authorURI foaf:name ?nameAuth }}
        bind( if(bound(?authorAgg), ?authorAgg, ?authorURI ) as ?author )
        # bind( if(bound(?nameAgg), ?nameAgg, ?nameAuth ) as ?name )
        filter(bound(?nameAgg) or bound(?nameAuth))

        filter( ?name = <{0}> )
        BIND(REPLACE(STR(?c),",","--") AS ?citation) .
    }}
    limit {1} offset {2}
    """

query_coauthorship = """
    select ?docURI ?authorURI ?author ?coauthorURI ?coauthor where {{ 
        ?docURI dcterms:creator ?x1, ?x2 .
            
        ?x1 hal:person ?authorURI .
        ?authorURI foaf:name ?author .

        ?x2 hal:person ?coauthorURI .
        ?coauthorURI foaf:name ?coauthor .

        filter( ?authorURI = <{0}> )
        filter(?x1 != ?x2)
        
    }} limit {1} offset {2}   
"""

