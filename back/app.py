from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import json
import datetime
import os
from init import execute, group_data, generate_sankey, by_author_dict, by_author_list, query_data, generate_timeline_data, save_data_bis, query_authors, coauthors_by_author_list, coauthors_by_author_dict, generate_timeline, save_author_data

app = Flask(__name__)
CORS(app)

@app.route('/api/save_data')
def do_save_data():
    print('Retrieving data from SPARQL endpoint ...')
    authors = execute( query_authors.format("I3S", 10, 0) )
    authors.to_csv('static/authors_list.csv', sep=',', index=False, header=authors.columns, mode='w')
    save_data_bis(authors)

    # save_authors_list()

    return jsonify({'message': 'done'})

@app.route('/api/group_data')
def do_group_data():
    group_data()
    return jsonify({'message': 'done'})

@app.route('/api/authors', methods=['GET'])
def get_authors():
    data = pd.read_csv('static/authors.csv').fillna('')

    res = []
    for row in data.values.tolist():
        res.append({ 'authorId': row[0], 'count': row[1] })

    return jsonify(res)
    
@app.route('/api/data', methods=['GET'])
def get_data():
    try:
        data = pd.read_json('static/data.json').fillna('')
    except :
        return jsonify([])

    res = []
    for row in data.values.tolist():
        for byYear in row[2]:
            # for byCountry in byYear['byCountry']:
                for doc in byYear['docs']:
                    res.append({
                        'authorId': row[0],
                        'authorName': row[1],
                        'docId': doc['docURI'],
                        'docTitle': doc['docTitle'],
                        'versionOf': doc['versionOf'],
                        'issuedAt': doc['issuedAt'],
                        'labId': doc['lab'],
                        'labName': doc['labName'],
                        'country': doc['country'],
                        'availableAt': doc['availableAt'],
                        'address': doc['address'],
                        'docType': doc['docType']
                    })

    return jsonify(res)

@app.route('/api/filters', methods=['GET'])
def get_filters():

    data = pd.read_json('static/data.json').fillna('')
    coauthors_data = pd.read_json('static/coauthors.json')

    coauthors = []
    for row in coauthors_data.values.tolist():
        coauthors.append({
            'id': row[0],
            'name': row[1],
            'coauthors': row[2]
        })
  
    years = set()

    for row in data.values.tolist():
        for byYear in row[2]:
            years.add(byYear['year'])

    return jsonify({ 'authors': coauthors, 'years': list(years)  })

@app.route('/api/sankey', methods=['POST'])
def build_sankey():
    form = request.json
    
    data = pd.read_csv('static/data.csv').fillna('')
    byAuthorDict = by_author_dict(data, form['authors'], form['countries'], form['years'])
    byAuthorList = by_author_list(byAuthorDict)
    # print(json.dumps(byAuthorList, indent=4, sort_keys=True))
    sankey_data = generate_timeline_data(byAuthorList)
    return jsonify(sankey_data)
    # return {}

@app.route('/api/transformedData', methods=['POST'])
def build_timeline():
    form = request.json
    data = pd.read_json('static/data.json')
    transformed_data = generate_timeline(data, form['authors'], form['years'])
    return jsonify(transformed_data)

@app.route('/api/save_author_data', methods=['POST'])
def do_save_author_data():
    form = request.json
    author_list = pd.read_csv('static/authors_list.csv').fillna('').values.tolist()
    exists = False
    for uri in form['uri']:
        if [uri, form['author']] in author_list:
            exists = True
        else:
            author_df = pd.DataFrame([[uri, form['author']]], columns=['uri', 'name'])
            author_df.to_csv('static/authors_list.csv', sep=',', index=False, header=False, mode='a')

    if exists:
        return jsonify({'message': 'exists'})

    save_author_data(form['uri'])
    return jsonify({'message': 'done'})


@app.route('/sankey')
def display_sankey():
    return render_template('sankey.html')  # render a template

# with app.test_client() as c:
#     # rv = c.post('/api/author_data', json={
#     #     'author': ['https://data.archives-ouvertes.fr/author/46480']
#     # })
#     # json_data = rv.get_json()
#     res = c.get('/api/group_data')
#     json_data = res.get_json()
#     # print(json.dumps(json_data, indent=4, sort_keys=True))

if __name__ == '__main__':
    app.run(host='localhost', port=5000)#, debug=False)
    #  debug = False

   
