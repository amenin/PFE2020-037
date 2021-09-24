class Timeline {
    constructor () {
        this.country_codes = []
        this.world = {}
        this.selected_countries = []
        this.svg = null
        this.width = null
        this.height = null
        this.margin = { top: 100, right: 100, bottom: 100, left: 100 }
        this.data = null
        this.freeze_links = null
        this.docTypes = {
            'conf': ['COMM', 'POSTER', 'PRESCONF', 'UNDEFINED'],
            'journal': ['ART'],
            'diplome': ['ETABTHESE', 'THESE', 'HDR' ],
            'art': ['MAP', 'PATENT', 'SON', 'VIDEO', 'IMG'],
            'book': ['OUV', 'BOOK', 'COUV', 'DOUV'],
            'gray': ['MEM', 'MINUTES', 'OTHER', 'OTHERREPORT', 'REPACT', 'REPORT', 'SYNTHESE', 'NOTE', 'MEMLIC']
        }
        this.symbol = {mainColor: '#ba5b5b', sndColor: '#e49b53', stroke: '#666666'}
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

        //// define scales ////
        this.xScale = d3.scaleBand()
            .paddingInner(0.2);
        
        this.yScale = d3.scalePoint()
            .padding(0.5)

        this.countryColor = d3.scaleThreshold()
            .range(['#f0f9e8','#bae4bc','#7bccc4','#43a2ca','#0868ac'])

        
        // this.width = this.width - this.margin.left - this.margin.right
        this.chart = { width: this.width - this.margin.left - this.margin.right, symbolSize : 15}
        
        this.mapGroup = this.svg.append('g')
            .attr('id', 'map-group')
            .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`); 

        this.chartGroup = this.svg.append('g')
            .attr('id', 'group-chart')
            .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`)

        this.chartGroup.append('g')
            .attr('id', 'bottom-axis')

        this.chartGroup.append('g')
            .attr('id', 'top-axis')
            .attr('transform', `translate(0, 0)`)

        this.leftAxis = this.chartGroup.append('g')
            .attr('id', 'left-axis')
            .attr('transform', `translate(0, 0)`)

        this.leftAxis.join('title')
            .text(`Click to pause/play the links animation\n\nRight click for more options`)

        this.chartGroup.append('g')
            .attr('id', 'wave-group')

        this.chartGroup.append('g')
            .attr('id', 'link-group')

        this.chartGroup.append('g')
            .attr('id', 'symbol-group')

        

        d3.select('body').on('click', function(){
            d3.selectAll('div.context-menu').style('display', 'none')
            if (d3.event.target.className !== 'zoom-control')
                d3.selectAll('div.zoom-div').style('display', 'none')
        })
    }

    clear() {
        this.svg.selectAll('g').remove()
    }

    update(data) {
        console.log(data)
        this.data = data;

        d3.selectAll('div.zoom-div').style('display', 'none')

        if (!Object.keys(data).length) return;

        const updateState = new Promise((resolve, reject) => {

            /// keep only one copy of each relationship
            this.data.links = this.data.links.filter((d,i) => i === this.data.links.findIndex(e => e.year === d.year && 
                ((e.source.name === d.source.name && e.target.name === d.target.name) || 
                (e.source.name === d.target.name && e.target.name === d.source.name))))
            
            
            /// keep only information for selected countries /////

            let nestedDataPerCountry = d3.nest()
                .key(d => d.country)
                .entries(data.docs)

            this.selected_countries = nestedDataPerCountry.map(d => {
                let authors = d.values.map(e => e.authorName)
                authors = authors.filter((d,i) => i === authors.indexOf(d))
    
                authors = authors.map(e => {
                    return {
                        'name': e,
                        'value': d.values.filter(v => v.authorName === e).length
                    }
                })
                
                let res = this.country_codes.filter(item => item.name === d.key);
                return {
                    'country': d.key, 
                    'authors': authors,
                    'value': d.values.length,
                    'alpha3': res.length ? res[0].alpha3 : null,
                    'alpha2': res.length ? res[0].alpha2 : null
                }
            })

            console.log(this.selected_countries)

            // map color code: count of publications per country
            let values = this.selected_countries.map(d => d.value);
            let breaks = ss.jenks(values, values.length >= 5 ? 5 : values.length)
            this.countryColor.domain(breaks)

            ////////////////////////////////////////////////////////////////////////////////

            this.nestedDataPerAuthor = d3.nest()
                .key(function(d) { return d.authorName; })
                .entries(this.data.docs)

            this.nestedDataPerYear = d3.nest()
                .key(d => d.pubYear)
                .sortKeys((a,b) => +a.pubYear - (+b.pubYear))
                .entries(this.data.docs)

            /// update the chart's height according to the number of authors and publications per year ///
            let maxHeight = d3.max(this.nestedDataPerYear, d => d.values.length) / 3
            maxHeight = 20 * maxHeight > 200 ? 20 * maxHeight : 200;

            const authors = this.nestedDataPerAuthor.map(d => d.key)

            this.chart.height =  maxHeight * authors.length

            if (this.chart.height + 150 > this.height)
                d3.select('div.vis').style('height', (this.chart.height + 150) + 'px');

            // resize svg according to chart
            this.svg.attr('width', this.width)
                .attr('height', this.chart.height + 150)
        
            this.dates = this.nestedDataPerYear.map(d => d.key)
            this.dates.sort((a,b) => +a - (+b))

            /// update scales' domain and range ///
            this.xScale.domain(this.dates)
                .range([0, this.chart.width])
    
            this.yScale.domain(authors)
                .range([this.chart.height, 0])

            // group different countries, adresses and labs per document and author ///
            this.groupedDocs = []

            const nestedDocsbyAuthor = d3.nest()
                .key(d => d.authorName)
                .key(d => d.docURI)
                .entries(this.data.docs)

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
                    this.groupedDocs.push(docData)
                })
            })

            resolve()
        });

        updateState.then(() => {
            this.draw()
        })
    }

    draw () { 
        

        // // create an array with name and uris of authors
        // let authorsInfo = []
        // authors.forEach(author => {
        //     let uris = docs.filter(d => d.authorName === author).map(d => d.authorURI)
        //     uris = uris.filter((d,i) => i === uris.indexOf(d))
        //     authorsInfo.push({
        //         'name': author,
        //         'uri': uris
        //     })            
        // })
       

        //// draw axes

        const xBottomAxis = d3.axisBottom()
            .ticks(this.dates.length)
            .tickFormat(d => d.toString())
            .scale(this.xScale)
        
        const xTopAxis = d3.axisTop()
            .ticks(this.dates.length)
            .tickFormat(d => d.toString())
            .scale(this.xScale)

        const yAxis = d3.axisLeft()
            .scale(this.yScale)

        this.svg.select('g#bottom-axis').attr('transform', `translate(0, ${this.chart.height})`).call(xBottomAxis)
        this.svg.select('g#top-axis').call(xTopAxis)       
        this.leftAxis.call(yAxis) 
        
        // add interaction to left axis
        this.leftAxis.selectAll(".tick text")
            .style('font-weight', 'bold')
            .style('font-size', '12px')
            .attr("dx", "-1em")
            .style('cursor', 'pointer')
            .on('mouseenter', d => {
                if (this.freeze_links) return;
                
                let linkElem = this.chartGroup.selectAll('g.link')
                    .style('opacity', e => e.source.name === d || e.target.name === d ? 1 : .02)

                linkElem.selectAll('line').style('stroke-width', 2)

                // highlight documents within line of co-authors
                let targets = this.data.links.filter(e => e.source.name === d || e.target.name === d)
                    .map(e => e.target.name === d ? e.source.name : e.target.name)
                
                let symbolGroup = this.chartGroup.selectAll('g.symbol-group')
                    .style('opacity', e => e.authorsList.includes(d) && e.authorsList.some(a => targets.includes(a)) ? 1 : .1)
    
                symbolGroup.filter(e => e.authorsList.includes(d) && e.authorsList.some(a => targets.includes(a)))
                    .selectAll('.symbol').filter(e => this.groupedDocs.filter(a => a.docURI === e.docURI).length == 1)
                    .style('stroke-dasharray', 4)
                    .style('stroke', '#000')

                this.chartGroup.selectAll('path.profile').style('opacity', e => d === e.key || targets.includes(e.key) ? .8 : .1)

                let countries = []
                this.data.docs.filter(e => e.authorsList.includes(d)).forEach(e => {
                    countries = countries.concat(e.country)
                })
              
                let countriesCodes = this.selected_countries.filter(e => countries.includes(e.country)).map(e => e.alpha3)

                this.svg.select('g#map-group').selectAll('path')
                    .style('fill', e => countriesCodes.includes(e.properties.alpha3) ? this.getCountryColor(e) : '#f4f4f4')

            })
            .on('mouseleave', () => {
                if (this.freeze_links) return;
                this.chartGroup.selectAll('g.link')
                    .style('opacity', 1)
                    .selectAll('line')
                    .style('stroke-width', 1)

                let symbolGroup = this.chartGroup.selectAll('g.symbol-group').style('opacity', 1)
                symbolGroup.selectAll('.symbol').style('stroke-dasharray', 'none').style('stroke', 'none')//.style('stroke-width', 1)
                
                this.chartGroup.selectAll('path.profile').style('opacity', .5)

                this.svg.select('g#map-group').selectAll('path').style('fill', d => this.getCountryColor(d))
                    
            })
            .on('click', d => {
                if (this.freeze_links && this.freeze_links != d) return;

                this.freeze_links = d === this.freeze_links ? null : d;
                
                this.leftAxis.selectAll('.tick text').style('color', d => this.freeze_links === d ? '#b20000' : '#000')
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
                        // const author_data = authorsInfo.filter(e => e.name === d)[0]
                        // author_data.uri = author_data.uri[0]
                        // fetchData(author_data)
                        // d3.select(this).style('display', 'none')
                    })
            })
            .call(wrap, this.yScale.step()/2)

        this.drawMap()
        this.drawProfileWave()
        this.drawLinks()
        this.drawDocSymbols()
       
       
    }

    drawSpatialGlyphs() {
        console.log(this.nestedDataPerYear)
        console.log(this.nestedDataPerCountry)
        console.log(this.nestedDocsbyAuthor)
    }

    drawDocSymbols() {
        /// publications per author, year and type ///////////////
        
        // group of documents
        const docsGroup = this.chartGroup.select('g#symbol-group')

        // group per symbol (some symbols include more than one info)
        const symbolGroup = docsGroup.selectAll('g')
            .data(this.groupedDocs)
            .join(
                enter => enter.append('g')
                    .classed('symbol-group', true)
                    .style('cursor', 'pointer')
                    .call(g => g.filter(d => !this.docTypes.gray.includes(d.docTypeCode)) // squares for conference, diplome and artistic/technical documents
                        .append('rect')
                        .attr('width', this.chart.symbolSize)
                        .attr('height', this.chart.symbolSize)
                        .attr('fill', this.symbol.mainColor)
                        .style('stroke', 'none')
                        .classed('symbol rect', true)
                    ).call(g => g.filter(d => this.docTypes.book.includes(d.docTypeCode)) // whole books and editions
                        .selectAll('rect')
                        .attr('width', this.chart.symbolSize * 1.5) 
                        .attr('fill', d => ['OUV', 'BOOK'].includes(d.docTypeCode) ? this.symbol.sndColor : this.symbol.mainColor)   
                    ).call(g => g.filter(d => d.docTypeCode == 'COUV') /// book chapters
                        .append('rect')
                        .attr('width', this.chart.symbolSize * .75)
                        .attr('height', this.chart.symbolSize)
                        .attr('fill', this.symbol.sndColor)
                        .style('stroke', 'none')
                    ).call(g => g.filter(d => this.docTypes.journal.includes(d.docTypeCode)) // journals
                        .selectAll('rect')
                        .attr('height', this.chart.symbolSize * 1.5)
                        .attr('fill', this.symbol.sndColor)
                    ).call(g => g.filter(d => this.docTypes.diplome.includes(d.docTypeCode)) // D in the center of square representing diplomes    
                        .append('text')
                        .style('text-anchor', 'middle')
                        .style('font-weight', 'bold')
                        .attr('x', this.chart.symbolSize / 2)
                        .attr('y', this.chart.symbolSize * .85)
                        .text('D')
                    ).call(g => g.filter(d => this.docTypes.art.includes(d.docTypeCode)) // colorful rectangle representing art
                        .append('rect')
                        .attr('height', this.chart.symbolSize * .3)
                        .attr('width', this.chart.symbolSize * .9)
                        .attr('fill', this.symbol.sndColor)
                        .attr('y', this.chart.symbolSize * .65)
                        .attr('x', this.chart.symbolSize * .05)
                    ).call(g => g.filter(d => this.docTypes.gray.includes(d.docTypeCode))
                        .append('circle')
                        .attr('r', this.chart.symbolSize/2)
                        .attr('fill', this.symbol.mainColor)
                        .style('stroke', 'none')
                        .classed('symbol', true)
                    ).call(g => g.append('title')
                        .text(d => `${d.country.join(', ')}
                            Author of Reference: ${d.authorName}
                            Affiliation(s): ${d.labName.join('\n\t\t\t')}\n
                            Title: ${d.docTitle}
                            Publication Year: ${d.pubYear}
                            Document Type: ${d.docType}\n
                            Bibliographic Citation: ${d.citation.split('&')[0]}\n
                            Click to go to source`)
                    ),
                update => update,
                exit => exit.remove()
            )
            .on('click', d => {
                window.open(d.hal)
            })
            .on('mouseenter', d => {
            
                if (!this.freeze_links)  {
                    // highlight documents within line of co-authors
                    symbolGroup.selectAll('.symbol')
                        .filter(e => e.docURI === d.docURI)
                        .style('stroke', '#000')
                        .style('stroke-width', 2)
                }
    
                /// highlight countries of co-authors
                let countries = []
                this.groupedDocs.filter(e => e.docURI === d.docURI).forEach(e => {
                    countries = countries.concat(e.country)
                })
    
                let countriesCodes = this.selected_countries.filter(e => countries.includes(e.country)).map(e => e.alpha3)
    
                this.svg.select('g#map-group').selectAll('path')
                    .style('fill', e => countriesCodes.includes(e.properties.alpha3) ? this.getCountryColor(e) : "#f4f4f4")
    
            }).on('mouseleave', d => {
                if (!this.freeze_links) 
                    symbolGroup.selectAll('.symbol').style('stroke', 'none')
                    
                    this.svg.select('g#map-group').selectAll('path').style('fill', d => this.getCountryColor(d))             
                
            })

        /// place circles close to each other using force simulation //////////////
        d3.forceSimulation()
            .force("x", d3.forceX().strength(0.4).x(d => this.xScale(d.pubYear)))
            .force("y", d3.forceY().strength(0.2).y(d => this.yScale(d.authorName) - this.chart.symbolSize / 2))
            .force("collide", d3.forceCollide().strength(.1).radius(this.chart.symbolSize).iterations(32)) // Force that avoids circle overlapping
            .nodes(this.groupedDocs)
            .on("tick", () => symbolGroup.attr('transform', e => `translate(${this.xScale.bandwidth()/2 + e.x}, ${e.y})`))
        
    }

    drawLinks() {
        ///------------------------------------------------------------------------------------------------------------------------------------
        //// co-authorship links ////////////

        const linksGroup = this.chartGroup.select('g#link-group')

        const lineAttrs = { x1: d => this.xScale.bandwidth()/ 2 + this.xScale(d.year),
            x2: d => this.xScale.bandwidth()/ 2 + this.xScale(d.year),
            y1: d => this.yScale(d.source.name),
            y2: d => this.yScale(d.target.name)
        }

        const xTicks = {
            x1: d => this.xScale.bandwidth()/ 2 + this.xScale(d.year) - headLength/2,
            x2: d => this.xScale.bandwidth()/ 2 + this.xScale(d.year) + headLength/2     
        }

        const sourceYTicks = {
            y1: d => this.yScale(d.source.name),
            y2: d => this.yScale(d.source.name)
        }

        const targetYTicks = {
            y1: d => this.yScale(d.target.name),
            y2: d => this.yScale(d.target.name)
        }

        const strokeDashArray = d => {
            let items = this.data.docs.filter(e => e.authorsList.includes(d.source.name) && 
                e.authorsList.includes(d.target.name) && e.pubYear === d.year)
            
            let nestedItems = d3.nest().key(e => e.docURI).entries(items)
            return nestedItems.every(e => e.values.length == 1) ? 4 : 'none'
        }

        let headLength = 4
        linksGroup.selectAll('g').data(this.data.links)
            .join(
                enter => enter.append('g')
                    .classed('link', true)
                    .call(g => g.append('line')
                        .classed('link-line', true)
                        .style('stroke', '#000')
                        .style('stroke-opacity', 1)
                        .attrs(lineAttrs)
                        .style('stroke-dasharray', strokeDashArray)
                    ).call(g => g.append('line')
                        .classed('source-tick', true)
                        .style('stroke', '#000')
                        .style('stroke-opacity', 1)
                        .attrs(xTicks)
                        .attrs(sourceYTicks)
                    ).call(g => g.append('line')
                        .classed('target-tick', true)
                        .style('stroke', '#000')
                        .style('stroke-opacity', 1)
                        .attrs(xTicks)
                        .attrs(targetYTicks)
                    ),
                    update => update
                        .call(g => g.select('line.link-line')
                            .attrs(lineAttrs)
                            .style('stroke-dasharray', strokeDashArray)
                        ).call(g => g.select('line.source-tick')
                            .attrs(xTicks)
                            .attrs(sourceYTicks)
                        ).call(g => g.select('line.target-tick')
                            .attrs(xTicks)
                            .attrs(targetYTicks)
                        ),
                    exit => exit.remove()
            )
    }

    drawProfileWave() {
        /// author wave profile //////////////
        
        /// author group /////////
        const waveGroup = this.chartGroup.select('g#wave-group')

        //// generate a list of values per year and author, containing even year without publications (this info does not come with the data from the server)
        let nestedData = this.nestedDataPerAuthor.map(d => {
            return {
                'values': d3.nest().key(e => e.pubYear).entries(d.values),
                'key': d.key
            }
        })

        let completeDataPerYear = []
        this.nestedDataPerAuthor.map(d => d.key).forEach(author => {
            this.dates.forEach(year => {
                if (!completeDataPerYear.some(x => x.key === year && x.authorName === author)){
                    let res = nestedData.filter(d => d.key === author)[0].values.filter(d => d.key === year)
                    res = res.length ? res[0].values.filter((d,i) => i === res[0].values.findIndex(e => e.docURI === d.docURI)) : []

                    let item = {
                        'year': year,
                        'author': author,
                        'values': res,
                    }

                    item[author] = res.length

                    completeDataPerYear.push(item)
                }
            })

        })

        const stack = d3.stack()
            .offset(d3.stackOffsetSilhouette)

        const waveData = this.nestedDataPerAuthor.map(d => {
            stack.keys([d.key])
            return stack(completeDataPerYear.filter(e => e.author === d.key).sort((a,b) => +a.year - (+b.year)))[0]
        })

        let min = 1000, max = -1000;
        waveData.forEach(d => {
            d.forEach(e => {
                if (min > e[0]) min = e[0];
                if (max < e[1]) max = e[1];
            })
        })


        const yWave = d3.scaleLinear()
            .domain([min, max])
            .range([-this.yScale.step() * .5, this.yScale.step() *.5]);
        
        const area = d3.area()
            .x(d =>  this.xScale.bandwidth()/ 2 + this.xScale(d.data.year))
            .y0(d => this.yScale(d.data.author) + yWave(d[0]))
            .y1(d => this.yScale(d.data.author) + yWave(d[1]))
            .curve(d3.curveMonotoneX)
        
        /// wave ////////
        waveGroup.selectAll('g.profile')
            .data(waveData)
            .join(
                enter => enter.append('g')
                    .style('opacity', 0.5)
                    .classed('profile', true)
                    .call(g => g.append('path')
                        .datum(d => d)
                        .style("fill", '#a3a3a3')
                        .attr("d", area)
                    ),
                update => update.call(g => g.select('path').attr("d", area)),
                exit => exit.remove()
            )
            .on('mouseenter', d => {
                if (this.freeze_links) return

                let visitedCountries = this.selected_countries.filter(e => e.authors.some(a => a.name === d.key)).map(e => e.alpha3)
               
                this.svg.select('g#map-group').selectAll('path')
                    .style('fill', e => visitedCountries.includes(e.properties.alpha3) ? this.getCountryColor(e) : "#f4f4f4")

                this.svg.selectAll('g.profile')
                    .style('opacity', e => e.key === d.key ? .8 : .2)

            }).on('mouseleave', d => {
                if (this.freeze_links) return

                this.svg.select('g#map-group').selectAll('path').style('fill', d => this.getCountryColor(d))

                this.svg.selectAll('g.profile').style('opacity', .5)
            })
            
    }

    getCountryColor(d) {
        let res = this.selected_countries.filter(e => e.alpha3 === d.properties.alpha3)
        return res.length ? this.countryColor(res[0].value) : "#f4f4f4";
    }

    drawMap () {           

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', function(){
                gCountries.selectAll('path') 
                    .attr('transform', d3.event.transform);
            });

        const mapGroup = this.svg.select('g#map-group')
            
        ///// world map ////////////
        const projection = d3.geoRobinson()
            .scale(300)
            .rotate([352, 0, 0])
            .translate([this.chart.width/2, this.chart.height/2]);

        const path = d3.geoPath().projection(projection);

        const gCountries = mapGroup.append('g')
            .attr('class', 'countries')
            .style('cursor', 'grab')
        
        
        const gCountry = gCountries.selectAll('g')
            .data(this.world.features)
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
            .style('fill', d => this.getCountryColor(d))
            .style('stroke', '#ccc')
            .style('opacity', 0.8)
            .style('stroke-width', 0.3)
            .on('mouseover', d => {
                if (this.freeze_links) return;

                if (!this.selected_countries.some(x => x.alpha3 === d.properties.alpha3)) return;

                d3.selectAll('g.symbol-group').style('opacity', e => {
                        let codes = this.selected_countries.filter(x => e.country.includes(x.country)).map(x => x.alpha3)
                        return codes.includes(d.properties.alpha3) ? 1 : .2
                    })
            })
            .on('mouseout', () => {
                if (this.freeze_links) return;
                d3.selectAll('g.symbol-group').style('opacity', 1)
            })
            // .call(zoom)

        gCountry.append('title')
            .text(d => d.properties.ADMIN)

        //// zoom & pan controls ////////
        
        d3.selectAll('button.zoom-control')
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

    drawPack(element, data, width, height) {
        const color = d3.scaleOrdinal(d3.schemeAccent);

        const svg = element.append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr("viewBox", [0, 0, width, height])
            .style("font", "10px sans-serif")
            .attr("text-anchor", "middle")
            .on("click", (event) => zoom(event, root));

        const root = d3.hierarchy(data)
            .count(d => d.children.length)
            .sort((a,b) => b.value - a.value)

        const pack = d3.pack()
            .size([width - 200, height])
            .padding(3)

        pack(root);      
        console.log(root.descendants())  

        let types = []
        const node = svg.append("g")
            .selectAll("circle")
            .data(root.descendants())
                .join("circle")
                .attr("fill", d => {
                    if (!types.includes(d.data.type))
                        types.push(d.data.type)
                    return color(d.data.type)
                })
                .attr("pointer-events", d => !d.children ? "none" : null)
                .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
                .on("mouseout", function() { d3.select(this).attr("stroke", null); })
                
            node.append('title')
                .text(d => `${d.ancestors().map(d => d.data.name).reverse().join(" -> ")}`)
        
        svg.append('rect')
            .attr('fill', 'whitesmoke')
            .attr('x', 1005)
            .attr('y', 5)
            .attr('width', 200)
            .attr('height', 120)

        svg.selectAll('text')
            .data(types)
            .enter()
                .append('text')
                .text(d => d)
                .attr('x', 1010)
                .attr('y', (_,i) => 20 * i + 10)
                .attr('fill', d => color(d))
                .attr('text-anchor', 'start')
    }
}