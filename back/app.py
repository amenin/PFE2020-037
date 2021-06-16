from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import json
import datetime
import os
from init import execute, save_data, group_data, generate_sankey, by_author_dict, by_author_list, query_authors, query_data, generate_parallelCoord, generate_timeline_data

app = Flask(__name__)
CORS(app)

@app.route('/api/save_data')
def do_save_data():
    authors = execute( query_authors.format(2, 100, 0) )
    authors.to_csv('static/authors.csv', sep=',', index=False, header=authors.columns, mode='w')
    save_data(authors)
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
            for byCountry in byYear['byCountry']:
                for doc in byCountry['docs']:
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
    authors = []
    countries = set()
    years = set()
    for row in data.values.tolist():
        authors.append({ 'id': row[0], 'name': row[1] })
        for byYear in row[2]:
            years.add(byYear['year'])
            for byCountry in byYear['byCountry']:
                countries.add(byCountry['country'])

    return jsonify({ 'authors': authors, 'countries': list(countries), 'years': list(years)  })

# @app.route('/api/sankeyData', methods=['GET'])
# def get_sankey_data():    
#     with open('static/sankey-formatted.json', encoding="utf8") as json_data:
#         data = json.load(json_data)
#     return jsonify(data)

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

@app.route('/api/parallelCoord', methods=['POST'])
def build_parallelCoord():
    form = request.json
    
    data = pd.read_csv('static/data.csv').fillna('')
    byAuthorDict = by_author_dict(data, form['authors'], form['countries'], form['years'])
    byAuthorList = by_author_list(byAuthorDict)
    # pc_data = generate_parallelCoord(byAuthorList)
    return jsonify(byAuthorList)


@app.route('/sankey')
def display_sankey():
    return render_template('sankey.html')  # render a template

    

if __name__ == '__main__':
    app.run(host='localhost', port=5000)

   
