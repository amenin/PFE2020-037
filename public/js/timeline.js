class Timeline {
    constructor () {
        this.country_codes = []
        this.world = {}
        this.selected_countries = []
        this.svg = null
        this.width = null
        this.height = null
        this.data = null
    }

    loadData () {
        var files = ['data/countries_fr.json', 'data/countries.geojson'];

        Promise.all(files.map(url => d3.json(url)))
        .then(values => {
            let worldData = values[1]
            worldData.features.forEach(d => {
                d.properties.alpha3 = d.properties.ISO_A3.toLowerCase()
            })

            this.country_codes = values[0]
            this.world = worldData
        })
    }

    init () {

        this.loadData()

        const buttons = [{'icon': '🗘', 'row': 0, 'col': 0, 'value': 'reset', 'action': 'reset'},
                {'icon': '+', 'row': 0, 'col': 1, 'value': 'plus', 'action': 'zoom'},
                {'icon': '-', 'row': 0, 'col': 2, 'value': 'minus', 'action': 'zoom'},
                {'icon': '>', 'row': 2.5, 'col': 2, 'value': 'right', 'action': 'pan'},
                {'icon': '<', 'row': 2.5, 'col': 0, 'value': 'left', 'action': 'pan'},
                {'icon': '>', 'row': 1.5, 'col': 1, 'value': 'up', 'action': 'pan'},
                {'icon': '<', 'row': 3.5, 'col': 1, 'value': 'down', 'action': 'pan'}]
        
        const div = d3.select('div.vis')
        this.width = div.node().clientWidth;
        this.height = div.node().clientHeight;
        this.svg = div.append('svg')

        div.append('div')
            .classed('zoom-div', true)
            .selectAll('button.zoom-control')
            .data(buttons)
            .enter()
                .append('button')
                .style('left', d => 10 + d.col * 35 + 'px')
                .style('top', d => 5 + d.row * 25 + 'px')
                .classed('zoom-control', true)
                .style('transform', d => ['up', 'down'].includes(d.value) ? 'rotate(-90deg)' : null)
                .text(d => d.icon)           

        div.append('div')
            .classed('context-menu', true)

        /// patterns for uncertain data
        const patternSize = 10;
        const stripesPattern = d3.select(this.node).selectAll('defs')
            .data(['#d69fa1', '#de425b'])
            .enter()
                .append('defs')
                .append('pattern')
                .attr('id', d => `${d}-stripe-pattern`)
                .attr('patternUnits', 'userSpaceOnUse')
                .attr('width', patternSize)
                .attr('height', patternSize)
        
        stripesPattern.append('rect')
            .attr('width', patternSize)
            .attr('height', patternSize)
            .style('fill', d => d)

        stripesPattern.append('path')
                .attr('d', 'M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2')
                .attr('stroke', '#000000')
                .attr('stroke-width', 1);
    }

    clear() {
        this.svg.selectAll('g').remove()
    }

    update(data) {
        console.log(data)
        this.data = data;

        this.svg.selectAll('g').remove()
        d3.selectAll('div.zoom-div').style('display', 'none')

        if (!Object.keys(data).length) return;

        const _this = this;
        const updateState = new Promise((resolve, reject) => {

            let nestedData = d3.nest()
                .key(d => d.country)
                .entries(data.docs)

            /// keep only information for selected countries /////
            _this.selected_countries = nestedData.map(d => {
                let authors = d.values.map(e => e.authorName)
                authors = authors.filter((d,i) => i === authors.indexOf(d))
    
                authors = authors.map(e => {
                    return {
                        'name': e,
                        'value': d.values.filter(v => v.authorName === e).length
                    }
                })
                
                let res = _this.country_codes.filter(item => item.name === d.key);
                return {
                    'country': d.key, 
                    'authors': authors,
                    'value': d.values.length,
                    'alpha3': res.length ? res[0].alpha3 : null,
                    'alpha2': res.length ? res[0].alpha2 : null
                }
            })
            resolve()
        });

        updateState.then(() => {
            this.draw()
        })
    }

    draw () {
        let docs = this.data.docs,
            countryCodes = this.selected_countries,
            links = this.data.links;

        const controls = {freeze_links: null}

        /// keep only one copy of each relationship
        links = links.filter((d,i) => i === links.findIndex(e => e.year === d.year && 
            ((e.source.name === d.source.name && e.target.name === d.target.name) || 
            (e.source.name === d.target.name && e.target.name === d.source.name))))

        let nestedData = d3.nest()
            .key(function(d) { return d.authorName; })
            .entries(docs)

        const nestedDocsbyAuthor = d3.nest()
            .key(d => d.authorName)
            .key(d => d.docURI)
            .entries(docs)

        // group different countries, adresses and labs per document and author
        let groupDocs = []
        nestedDocsbyAuthor.forEach(author => {
            author.values.forEach(doc => {
                let addresses = doc.values.map(d => d.address)
                addresses = addresses.filter((d,i) => i === addresses.indexOf(d))

                let countries = doc.values.map(d => d.country)
                countries = countries.filter((d,i) => i === countries.indexOf(d))

                let labs = doc.values.map(d => d.labName)
                labs = labs.filter((d,i) => i === labs.indexOf(d))

                let docData = doc.values[0]
                docData.authorsList = docData.authorsList.map(d => d.name)
                docData.address = addresses
                docData.country = countries
                docData.labName = labs
                groupDocs.push(docData)
            })
        })

        // classification of document types
        const docTypes = {
            'conf': ['COMM', 'POSTER', 'PRESCONF', 'UNDEFINED'],
            'journal': ['ART'],
            'diplome': ['ETABTHESE', 'THESE', 'HDR' ],
            'art': ['MAP', 'PATENT', 'SON', 'VIDEO', 'IMG'],
            'book': ['OUV', 'BOOK', 'COUV', 'DOUV'],
            'gray': ['MEM', 'MINUTES', 'OTHER', 'OTHERREPORT', 'REPACT', 'REPORT', 'SYNTHESE', 'NOTE', 'MEMLIC']
        }
        const symbol = {mainColor: '#ba5b5b', sndColor: '#e49b53', stroke: '#666666'}

        let nestedDataByyear = d3.nest()
            .key(d => d.pubYear)
            .entries(docs)

        let maxHeight = d3.max(nestedDataByyear, d => d.values.length) / 3
        maxHeight = 20 * maxHeight > 200 ? 20 * maxHeight : 200;

        const authors = nestedData.map(d => d.key)

        // create an array with name and uris of authors
        let authorsInfo = []
        authors.forEach(author => {
            let uris = docs.filter(d => d.authorName === author).map(d => d.authorURI)
            uris = uris.filter((d,i) => i === uris.indexOf(d))
            authorsInfo.push({
                'name': author,
                'uri': uris
            })            
        })
        
        const margin = { top: 100, right: 0, bottom: 100, left: 100 },
            width = this.width - margin.left - margin.right,
            chart = { width: width * .95, height: maxHeight * authors.length, symbolSize: 15 };

        // resize svg according to chart
        this.svg.attr('width', this.width).attr('height', chart.height + 150)

         // map color code: count of publications per country
        let values = countryCodes.map(d => d.value);
        let breaks = ss.jenks(values, values.length >= 5 ? 5 : values.length)
        const countryColor = d3.scaleThreshold()
            .domain(breaks)
            .range(['#f0f9e8','#bae4bc','#7bccc4','#43a2ca','#0868ac'])

        if (chart.height + 150 > this.height)
            d3.select('div.vis').style('height', (chart.height + 150) + 'px');

        const _this = this;
        createMap()

        const chartGroup =  this.svg.append('g')
            .attr('id', 'group-chart')
            .attr('transform', `translate(${margin.left}, ${margin.top})`)

        ///// axes ////////////////
        
        let dates = nestedDataByyear.map(d => d.key)
        dates.sort((a,b) => +a - (+b))

        const xScale = d3.scaleBand()
            .domain(dates)
            .range([0, chart.width])
            .paddingInner(0.2);

        const xAxis = d3.axisBottom()
            .ticks(dates.length)
            .tickFormat(d => d.toString())
            .scale(xScale)

        const xTopAxis = d3.axisTop()
            .ticks(dates.length)
            .tickFormat(d => d.toString())
            .scale(xScale)

        chartGroup.append('g')
            .attr('transform', `translate(0, ${chart.height})`)
            .call(xAxis)

        chartGroup.append('g')
            .attr('transform', `translate(0, 0)`)
            .call(xTopAxis)

        /// y axis (authors' names)
        const yScale = d3.scalePoint()
            .domain(authors)
            .range([chart.height, 0])
            .padding(0.5)

        const yAxis = d3.axisLeft()
            .scale(yScale)
        
        const yAxisGroup = chartGroup.append('g')
            .attr('transform', `translate(0, 0)`)
            .attr('id', 'x-group')
            .call(yAxis)

        yAxisGroup.append('title')
            .text(`Click to pause/play the links animation\n\nRight click for more options`)

        yAxisGroup.selectAll(".tick text")
            .style('font-weight', 'bold')
            .style('font-size', '12px')
            .attr("dx", "-1em")
            .style('cursor', 'pointer')
            .on('mouseenter', d => {
                if (controls.freeze_links) return;
                
                let linkElem = chartGroup.selectAll('g.link')
                    .style('opacity', e => e.source.name === d || e.target.name === d ? 1 : .02)

                linkElem.selectAll('line').style('stroke-width', 2)

                // highlight documents within line of co-authors
                let targets = links.filter(e => e.source.name === d || e.target.name === d)
                    .map(e => e.target.name === d ? e.source.name : e.target.name)
                
                chartGroup.selectAll('g.symbol-group')
                    .style('opacity', e => e.authorsList.includes(d) && e.authorsList.some(a => targets.includes(a)) ? 1 : .1)
    
                symbolGroup.filter(e => e.authorsList.includes(d) && e.authorsList.some(a => targets.includes(a)))
                    .selectAll('.symbol').filter(e => groupDocs.filter(a => a.docURI === e.docURI).length == 1)
                    .style('stroke-dasharray', 4)
                    .style('stroke', '#000')

                chartGroup.selectAll('path.profile').style('opacity', e => d === e.key || targets.includes(e.key) ? .8 : .1)

                let countries = []
                docs.filter(e => e.authorsList.includes(d)).forEach(e => {
                    countries = countries.concat(e.country)
                })
              
                let countriesCodes = countryCodes.filter(e => countries.includes(e.country))

                this.svg.select('g#map-group').selectAll('path')
                    .style('fill', d => {
                        let res = countriesCodes.filter(e => e.alpha3 === d.properties.alpha3)
                        return res.length ? countryColor(res[0].value) : "#f4f4f4";
                    })

            })
            .on('mouseleave', () => {
                if (controls.freeze_links) return;
                chartGroup.selectAll('g.link')
                    .style('opacity', 1)
                    .selectAll('line')
                    .style('stroke-width', 1)

                let symbolGroup = chartGroup.selectAll('g.symbol-group').style('opacity', 1)
                symbolGroup.selectAll('.symbol').style('stroke-dasharray', 'none').style('stroke', 'none')//.style('stroke-width', 1)
                
                chartGroup.selectAll('path.profile').style('opacity', .5)

                this.svg.select('g#map-group').selectAll('path')
                    .style('fill', d => {
                        let res = countryCodes.filter(e => e.alpha3 === d.properties.alpha3)
                        return res.length ? countryColor(res[0].value) : "#f4f4f4";
                    })
            })
            .on('click', function(d) {
                if (controls.freeze_links && controls.freeze_links != d) return;

                controls.freeze_links = d === controls.freeze_links ? null : d;
                
                d3.select(this).style('color', d => controls.freeze_links ? '#b20000' : '#000')
            })
            .on('contextmenu', d => {
                d3.event.preventDefault()
                const x = d3.event.layerX,
                    y = d3.event.layerY

                d3.select('div.context-menu')
                    .style('left', x + 'px')
                    .style('top', y + 'px')
                    .style('display', 'block')
                    .html(`Fetch Data and Focus on ${d}`)
                    .on('click', function() {
                        const author_data = authorsInfo.filter(e => e.name === d)[0]
                        author_data.uri = author_data.uri[0]
                        fetchData(author_data)
                        d3.select(this).style('display', 'none')
                    })
            })
            .call(wrap, yScale.step()/2)

        ///// authors ///////////////////////  

        ///// wave //////

        //// create complete dataset with missing years for each author accorging to "dates" ///
        nestedData = nestedData.map(d => {
            return {
                'values': d3.nest().key(e => e.pubYear).entries(d.values),
                'key': d.key
            }
        })

        let dataPerYear = []
        authors.forEach(author => {
            dates.forEach(year => {
                if (!dataPerYear.some(x => x.key === year && x.authorName === author)){
                    let res = nestedData.filter(d => d.key === author)[0].values.filter(d => d.key === year)
                    dataPerYear.push({
                        'pubYear': year,
                        'authorName': author,
                        'values': res.length ? res[0].values.filter((d,i) => i === res[0].values.findIndex(e => e.docURI === d.docURI)) : []
                    })
                }
            })

            dataPerYear.forEach(e => {
                e[author] = e.values.length
            })
        })
        
        dataPerYear.sort((a,b) => +a.pubYear - (+b.pubYear))

        /// author wave profile //////////////
        const yWave = d3.scaleLinear()
            .domain([-2, 2])
            .range([ yScale.step() * .05, -yScale.step() * .05 ]);
        
        const stack = d3.stack()
            .offset(d3.stackOffsetSilhouette)

        const area = d3.area()
            .x(function(d, i) { return xScale.bandwidth()/ 2 + xScale(d.data.pubYear); })
            .y0(function(d) { return yScale(d.data.authorName) - yWave(d[0]); })
            .y1(function(d) { return yScale(d.data.authorName) - yWave(d[1]); })
            .curve(d3.curveMonotoneX)
        
        /// author group /////////
        const waveGroup = chartGroup.append('g')

        /// wave ////////
        const profileGroup = waveGroup.selectAll('g.profile')
            .data(nestedData)
            .enter()
                .append('g')

        profileGroup.selectAll("path")
            .data(d => {
                stack.keys([d.key])
                return stack(dataPerYear.filter(e => e.authorName === d.key))
            })
            .enter()
                .append("path")
                .classed('profile', true)
                .style("fill", '#a3a3a3')
                .attr("d", area)
                .style('opacity', 0.5)
                .on('mouseenter', d => {
                    let visitedCountries = countryCodes.filter(e => e.authors.some(a => a.name === d.key))

                    this.svg.select('g#map-group').selectAll('path')
                        .style('fill', d => {
                            let res = visitedCountries.filter(e => e.alpha3 === d.properties.alpha3)
                            return res.length ? countryColor(res[0].value) : "#f4f4f4";
                        })

                    this.svg.selectAll('path.profile')
                        .style('opacity', e => e.key === d.key ? .8 : .2)

                }).on('mouseleave', d => {
                    this.svg.select('g#map-group').selectAll('path')
                        .style('fill', d => {
                            let res = countryCodes.filter(e => e.alpha3 === d.properties.alpha3)
                            return res.length ? countryColor(res[0].value) : "#f4f4f4";
                        })

                    this.svg.selectAll('path.profile').style('opacity', .5)
                })

        ///------------------------------------------------------------------------------------------------------------------------------------
        //// co-authorship links ////////////

        const linksGroup = chartGroup.append('g')

        const link = linksGroup.selectAll('g')
            .data(links)
            .enter()
                .append('g')
                .classed('link', true)        

        const lines = link.append('line')
            .attr('x1', d => xScale.bandwidth()/ 2 + xScale(d.year))
            .attr('x2', d => xScale.bandwidth()/ 2 + xScale(d.year))
            .attr('y1', d => yScale(d.source.name))
            .attr('y2', d => yScale(d.target.name))
            .style('stroke', '#000')
            .style('stroke-opacity', 1)

        lines.filter(d => {
            let items = docs.filter(e => e.authorsList.includes(d.source.name) && 
                e.authorsList.includes(d.target.name) && e.pubYear === d.year)
            
            let nestedItems = d3.nest().key(e => e.docURI).entries(items)
            return nestedItems.every(e => e.values.length == 1)
        })
        .style('stroke-dasharray', 4)

        let headLength = 7
        link.append('line')
            .attr('x1', d => xScale.bandwidth()/ 2 + xScale(d.year) - headLength/2)
            .attr('x2', d => xScale.bandwidth()/ 2 + xScale(d.year) + headLength/2)
            .attr('y1', d => yScale(d.source.name))   
            .attr('y2', d => yScale(d.source.name))   
            .style('stroke', '#000')
            .style('stroke-opacity', 1)

        link.append('line')
            .attr('x1', d => xScale.bandwidth()/ 2 + xScale(d.year) - headLength/2)
            .attr('x2', d => xScale.bandwidth()/ 2 + xScale(d.year) + headLength/2)
            .attr('y1', d => yScale(d.target.name))   
            .attr('y2', d => yScale(d.target.name))   
            .style('stroke', '#000')
            .style('stroke-opacity', 1)






        /// publications per author, year and type ///////////////
        
        // group of documents
        const docsGroup = chartGroup.append('g')

        // group per symbol (some symbols include more than one info)
        const symbolGroup = docsGroup.selectAll('g')
                .data(groupDocs)
                .enter()
                    .append('g')
                    .classed('symbol-group', true)
                    .style('cursor', 'pointer')
                    .on('click', d => {
                        window.open(d.hal)
                    })

        // squares for conference, diplome and artistic/technical documents
        symbolGroup.filter(d => !docTypes.gray.includes(d.docTypeCode))
            .append('rect')
            .attr('width', chart.symbolSize)
            .attr('height', chart.symbolSize)
            .attr('fill', symbol.mainColor)
            // .style('stroke', symbol.stroke)
            .style('stroke', 'none')
            .classed('symbol', true)

        // whole books and editions
        symbolGroup.filter(d => docTypes.book.includes(d.docTypeCode))
            .selectAll('rect')
            .attr('width', chart.symbolSize * 1.5) 
            .attr('fill', d => ['OUV', 'BOOK'].includes(d.docTypeCode) ? symbol.sndColor : symbol.mainColor)   

        /// book chapters
        symbolGroup.filter(d => d.docTypeCode == 'COUV')
            .append('rect')
            .attr('width', chart.symbolSize * .75)
            .attr('height', chart.symbolSize)
            .attr('fill', symbol.sndColor)
            // .style('stroke', symbol.stroke)
            .style('stroke', 'none')

        // journals
        symbolGroup.filter(d => docTypes.journal.includes(d.docTypeCode))
            .selectAll('rect')
            .attr('height', chart.symbolSize * 1.5)
            .attr('fill', symbol.sndColor)

        // D in the center of square representing diplomes    
        symbolGroup.filter(d => docTypes.diplome.includes(d.docTypeCode))
            .append('text')
            .style('text-anchor', 'middle')
            .style('font-weight', 'bold')
            .attr('x', chart.symbolSize / 2)
            .attr('y', chart.symbolSize * .85)
            .text('D')

        // colorful rectangle representing art
        symbolGroup.filter(d => docTypes.art.includes(d.docTypeCode))
            .append('rect')
            .attr('height', chart.symbolSize * .3)
            .attr('width', chart.symbolSize * .9)
            .attr('fill', symbol.sndColor)
            .attr('y', chart.symbolSize * .65)
            .attr('x', chart.symbolSize * .05)
        
        symbolGroup.filter(d => docTypes.gray.includes(d.docTypeCode))
            .append('circle')
            .attr('r', chart.symbolSize/2)
            .attr('fill', symbol.mainColor)
            // .style('stroke', symbol.stroke)
            .style('stroke', 'none')
            .classed('symbol', true)

        symbolGroup.on('mouseenter', d => {
            
            if (!controls.freeze_links)  {
                // highlight documents within line of co-authors
                symbolGroup.selectAll('.symbol')
                    .filter(e => e.docURI === d.docURI)
                    .style('stroke', '#000')
                    .style('stroke-width', 2)
            }

            /// highlight countries of co-authors
            let countries = []
            groupDocs.filter(e => e.docURI === d.docURI).forEach(e => {
                countries = countries.concat(e.country)
            })

            let countriesCodes = countryCodes.filter(e => countries.includes(e.country))

            this.svg.select('g#map-group').selectAll('path')
                // .style('stroke-width', d => countriesCodes.includes(d.properties.alpha3) ? 1.2 / k : .3)
                // .style('stroke', d => countriesCodes.includes(d.properties.alpha3) ? '#000' : '#ccc')
                .style('fill', d => {
                    let res = countriesCodes.filter(e => e.alpha3 === d.properties.alpha3)
                    return res.length ? countryColor(res[0].value) : "#f4f4f4";
                })

        }).on('mouseleave', d => {
            if (!controls.freeze_links) 
                symbolGroup.selectAll('.symbol').style('stroke', 'none')
                
                this.svg.select('g#map-group').selectAll('path')
                    .style('fill', d => {
                        let res = countryCodes.filter(e => e.alpha3 === d.properties.alpha3)
                        return res.length ? countryColor(res[0].value) : "#f4f4f4";
                    })
                //.style('stroke', symbol.stroke).style('stroke-width', 1)
            // svg.select('g#map-group').selectAll('path').style('fill', "#f4f4f4")
            // .style('stroke-width', '.3').style('stroke', '#ccc')
            
            
        })
        
        /// place circles close to each other using force simulation //////////////
        d3.forceSimulation()
            .force("x", d3.forceX().strength(0.4).x(d => xScale(d.pubYear)))
            .force("y", d3.forceY().strength(0.2).y(d => yScale(d.authorName) - chart.symbolSize / 2))
            .force("collide", d3.forceCollide().strength(.1).radius(chart.symbolSize).iterations(32)) // Force that avoids circle overlapping
            .nodes(groupDocs)
            .on("tick", () => symbolGroup.attr('transform', e => `translate(${xScale.bandwidth()/2 + e.x}, ${e.y})`))
        

        symbolGroup.append('title')
            .text(d => `${d.country.join(', ')}
                Author of Reference: ${d.authorName}
                Affiliation(s): ${d.labName.join('\n\t\t\t')}\n
                Title: ${d.docTitle}
                Publication Year: ${d.pubYear}
                Document Type: ${d.docType}\n
                Bibliographic Citation: ${d.citation.split('&')[0]}\n
                Click to go to source`)
        

        function createMap () {           
    
            const chart = {width: _this.width, height: _this.height},
                margin = {top: 30, left: 0, right: 0, bottom: 0};
    
            const zoom = d3.zoom()
                .scaleExtent([1, 8])
                .on('zoom', function(){
                    gCountries.selectAll('path') 
                        .attr('transform', d3.event.transform);
                });
            
            // const svg = _this.svg.attr('width', chart.width)
            //     .attr('height', chart.height)
    
            // svg.select('g#map-group').remove()
    
            const mapGroup = _this.svg.append('g')
                .attr('id', 'map-group')
                .attr('transform', `translate(${margin.left}, ${margin.top})`); 
                
            ///// world map ////////////
            const projection = d3.geoRobinson()
                .scale(300)
                .rotate([352, 0, 0])
                .translate([chart.width/2, chart.height/2]);
    
            const path = d3.geoPath().projection(projection);
    
            const gCountries = mapGroup.append('g')
                .attr('class', 'countries')
                .style('cursor', 'grab')
            
            
            const gCountry = gCountries.selectAll('g')
                .data(_this.world.features)
                .enter()
                    .append('g')
                    .on('contextmenu', function(d) {
                        d3.event.preventDefault()
                        const x = d3.event.layerX,
                            y = d3.event.layerY

                        d3.selectAll('div.zoom-div')
                            .style('display', 'block')
                            .style('left', x + 'px')
                            .style('top', y + 'px')
                    })
            
            gCountry.append('path') 
                .attr('d', path)
                .style('fill', d => {
                    let res = countryCodes.filter(e => e.alpha3 === d.properties.alpha3)
                    return res.length ? countryColor(res[0].value) : "#f4f4f4";
                })
                .style('stroke', '#ccc')
                .style('opacity', 0.8)
                .style('stroke-width', 0.3)
                .on('mouseover', d => {
                    if (controls.freeze_links) return;

                    if (!countryCodes.some(x => x.alpha3 === d.properties.alpha3)) return;
    
                    d3.selectAll('g.symbol-group').style('opacity', e => {
                            let codes = countryCodes.filter(x => e.country.includes(x.country)).map(x => x.alpha3)
                            return codes.includes(d.properties.alpha3) ? 1 : .2
                        })
                        // .selectAll('.symbol')
                        // .style('stroke-width', 2)
                        // .style('stroke', '#000')
                })
                .on('mouseout', () => {
                    if (controls.freeze_links) return;
                    d3.selectAll('g.symbol-group').style('opacity', 1)
                    // d3.selectAll('.symbol').style('stroke-width', 1).style('stroke', "#666666")
                })
                // .call(zoom)
    
            gCountry.append('title')
                .text(d => d.properties.ADMIN)
    
            //// zoom & pan controls ////////
            
            d3.selectAll('button.zoom-control')
                // .style('display', 'inline-block')
                .on('click', d => {
                    let value = 30;
                    let selection = gCountries.selectAll('path').transition().duration(500);
                    switch(d.action) {
                        case 'zoom':
                            value = d.value === 'plus' ? 1.3 : 1 / 1.3;
                            zoom.scaleBy(selection, value)
                            break;
                        case 'pan':
                            let x = 0, y = 0;
    
                            if (d.value === 'up') y = -value
                            else if (d.value === 'down') y = value
                            else if (d.value === 'left') x = -value
                            else x = value
                            zoom.translateBy(selection, x, y)
                            break;
                        case 'reset':
                            selection.call(zoom.transform, d3.zoomIdentity);
                            break;
                    }
                    
                })            
        }

        d3.select('body').on('click', function(){
            d3.selectAll('div.context-menu').style('display', 'none')
            if (d3.event.target.className !== 'zoom-control')
                d3.selectAll('div.zoom-div').style('display', 'none')
        })
    }
}