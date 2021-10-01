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
        this.symbol = {mainColor: '#dcdcdc', sndColor: '#7a7a7a', stroke: '#313131'}
    }

    loadData () {
        var files = ['data/countries.json', 'data/countries.geojson'];

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

        // const buttons = [{'icon': '🗘', 'row': 0, 'col': 0, 'value': 'reset', 'action': 'reset'},
        //         {'icon': '+', 'row': 0, 'col': 1, 'value': 'plus', 'action': 'zoom'},
        //         {'icon': '-', 'row': 0, 'col': 2, 'value': 'minus', 'action': 'zoom'},
        //         {'icon': '>', 'row': 2.5, 'col': 2, 'value': 'right', 'action': 'pan'},
        //         {'icon': '<', 'row': 2.5, 'col': 0, 'value': 'left', 'action': 'pan'},
        //         {'icon': '>', 'row': 1.5, 'col': 1, 'value': 'up', 'action': 'pan'},
        //         {'icon': '<', 'row': 3.5, 'col': 1, 'value': 'down', 'action': 'pan'}]
        
        const div = d3.select('div.vis')
        this.width = div.node().clientWidth;
        this.height = div.node().clientHeight;
        this.svg = div.append('svg')

        // div.append('div')
        //     .classed('zoom-div', true)
        //     .selectAll('button.zoom-control')
        //     .data(buttons)
        //     .enter()
        //         .append('button')
        //         .style('left', d => 10 + d.col * 35 + 'px')
        //         .style('top', d => 5 + d.row * 25 + 'px')
        //         .classed('zoom-control', true)
        //         .style('transform', d => ['up', 'down'].includes(d.value) ? 'rotate(-90deg)' : null)
        //         .text(d => d.icon)           

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
        
        this.svg.append('g')
            .attr('id', 'flag-pattern-group')

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
            .attr('id', 'link-group')


        // this.chartGroup.append('g')
        //     .attr('id', 'symbol-group')

        
        d3.select('body').on('click', function(){
            d3.selectAll('div.context-menu').style('display', 'none')
            if (d3.event.target.className !== 'zoom-control')
                d3.selectAll('div.zoom-div').style('display', 'none')
        })

        this.docTypeColor = d3.scaleOrdinal()   
            .domain(Object.keys(this.docTypes))
            .range(['#215f92','#4c87a3','#88adb4','#9ecfb6','#96c782','#aeb640'])

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

            this.authors = this.nestedDataPerAuthor.map(d => d.key)

            this.chart.height =  maxHeight * this.authors.length

            if (this.chart.height + 150 > this.height)
                d3.select('div.vis').style('height', (this.chart.height + 150) + 'px');

            // resize svg according to chart
            this.svg.attr('width', this.width)
                .attr('height', this.chart.height + 150)
   
            this.chartGroup.selectAll('g.author')
                .data(this.authors)
                .join(
                    enter => enter.append('g').classed('author', true),
                    update => update,
                    exit => exit.remove()
                )
        
            this.dates = this.nestedDataPerYear.map(d => d.key)
            this.dates.sort((a,b) => +a - (+b))

            /// update scales' domain and range ///
            this.xScale.domain(this.dates)
                .range([0, this.chart.width])
    
            this.yScale.domain(this.authors)
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

                    let docData = JSON.parse(JSON.stringify(doc.values[0]))
                    docData.authorsList = docData.authorsList.map(d => d.name)
                    docData.address = addresses
                    docData.country = countries
                    docData.labName = labs
                    this.groupedDocs.push(docData)
                })
            })
            this.setFlagPattern()

            resolve()
        });

        updateState.then(() => {
            this.draw()
        })
    }

    setFlagPattern(){
        let patternWidth = 30,
            patternHeight = 20;
        this.svg.select('g#flag-pattern-group')
            .selectAll('defs')
            .data(this.selected_countries)
            .join(
                enter => enter.append('defs')
                    .call(defs => defs.append("pattern")
                        .attr("id", d => "flag_" + d.country)
                        .attr("width", patternWidth)
                        .attr("height", patternHeight)
                        .attr("patternUnits", "userSpaceOnUse")
                        .call(pattern => pattern.append('rect')
                            .attr('width', patternWidth)
                            .attr('height', patternHeight)
                            .attr('fill', 'whitesmoke')
                        )
                        .call(pattern => pattern.append("svg:image")
                            .attr("xlink:href", d => `flags/${d.alpha2}.svg`)
                            .attr("width", patternWidth - 2)
                            .attr("height", patternHeight - 2)
                            .attr("x", 5)
                            .attr("y", 2.5)
                            .style('filter', 'blur(1px)')
                            .style('opacity', 1)
                        )
                    ),
                update => update,
                exit => exit.remove()
            )

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
                
                    console.log(targets)
                    // verify this part of the code, is not working to identify whether both symbols contain both authors 
                let hasAuthor = e => { return e.authorsList.some(x => x.name === d) && e.authorsList.some(a => targets.includes(a.name)) }
                let uncertainDoc = e => { return this.groupedDocs.filter(a => a.docURI === e.docURI).length == 1 }

                let symbolGroup = this.chartGroup.selectAll('.doc')
                    .style('opacity', e => hasAuthor(e) ? 1 : .2)
    
                symbolGroup.style('stroke-width', e => hasAuthor(e) ? 2 : 1)
                    .style('stroke-dasharray', e => hasAuthor(e) && uncertainDoc(e) ? 4 : 'none')
                    .style('stroke', e => hasAuthor(e) && uncertainDoc(e) ? '#000' : 'none')

                this.chartGroup.selectAll('g.author').style('opacity', e => d === e || targets.includes(e) ? 1 : .2)

            })
            .on('mouseleave', () => {
                if (this.freeze_links) return;
                this.chartGroup.selectAll('g.link')
                    .style('opacity', 1)
                    .selectAll('line')
                    .style('stroke-width', 1)

                let symbolGroup = this.chartGroup.selectAll('.doc').style('opacity', 1)
                symbolGroup.style('stroke-dasharray', 'none').style('stroke', 'none').style('stroke-width', 1)
                
                this.chartGroup.selectAll('g.author').style('opacity', 1)
                    
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

        // this.drawMap()
        this.drawProfileWave()
        this.drawEllipses()
        this.drawLinks()
        // this.drawDocSymbols()
        // this.drawSpatialGlyphs()
       
    }

    drawSpatialGlyphs() {

        let nestedPerAuthorYearCountry = d3.nest()
            .key(d => d.authorName)
            .key(d => d.pubYear)
            .key(d => typeof d.country == 'string' ? d.country : d.country[0])
            .entries(this.data.docs)

        console.log(nestedPerAuthorYearCountry)

        // verufy whether there are dublons per country, like a person associated to multiple institutions for a single paper
        // draw a glyph (pie chart) over each year to represent the amount of papers per country
        // allow to click and to show a collaboration chart


    }

    drawEllipses() {

        let docs = [];

        let ellipseData = this.authors.map(author => {

            const authorData = this.countDocsPerYear.filter(e => e.author === author)
            this.stack.keys([author])
            let stackedData = this.stack(authorData)[0]

            stackedData = stackedData.map(d => {
                
                let ry = this.yWave(d[1])
                d.data.docs.forEach(doc => {
                    doc.parentHeight = ry
                })
                docs = docs.concat(d.data.docs)

                return {
                    'ry': ry,
                    'author': d.data.author,
                    'parent': d.data.year,
                    'docs': d.data.docs
                }
                
            })
            
            return {
                'author': author,
                'data' : stackedData.filter(d => d.docs.length) 
            }
        }) 

        let authorGroup = this.chartGroup.selectAll('g.author')

        let minRadius = d3.min(docs.map(d => d.parentHeight)) * .9

        authorGroup.selectAll('g.ellipses')
            .data(d => ellipseData.filter(e => e.author === d))
            .join(
                enter => enter.append('g')
                    .classed('ellipses', true)
                    .call(g => g.selectAll('g')
                        .data(d => d.data)
                        .join('g')
                        .call(g => g.append('ellipse')
                            .attrs({
                                cx: d => this.xScale(d.parent) + this.xScale.bandwidth()/2,
                                cy: d => this.yScale(d.author),
                                rx: this.xScale.bandwidth() * .4,
                                ry: d => d.ry
                            })
                            .attr('fill', 'white')
                            .attr('stroke', '#a3a3a3')
                        )
                        .call(g => g.selectAll('circle.doc')
                            .data(d => d.docs)
                            .join('circle')
                            .classed('doc', true)
                            .attr('r', minRadius)
                            .attr('fill', d => this.docTypeColor(Object.keys(this.docTypes).find(key => this.docTypes[key].includes(d.docTypeCode))))
                            .attr('stroke', 'none')
                            .on('click', d => {
                                window.open(d.hal)
                            })
                            .on('mouseenter', d => {
                                if (this.freeze_links)  return
                                    // highlight documents within line of co-authors
                                    this.svg.selectAll('.doc')
                                        .filter(e => e.docURI === d.docURI)
                                        .style('stroke', '#000')
                                        .style('stroke-width', 2)
                            }).on('mouseleave', d => {
                                if (this.freeze_links)  return
                                this.svg.selectAll('.doc').style('stroke-width', 1).style('stroke', 'none')
                            })
                            .call(circle => circle.append('title')
                                .text(d => `Publication Year: ${d.pubYear}\nPublication Title: ${d.docTitle}\nDocument Type: ${d.docType}\n\nBibliographic Citation: ${d.citation.split('&')[0]}\n\n--------------------\nAbout the author\nName: ${d.authorName}\nAffiliation(s): ${d.labName.join('\n\t\t\t')}\nCountry: ${d.country.join(', ')}\n\nClick to go to source`)
                            )
                        )
                    ),
                update => update,
                exit => exit.remove()
            )
        
        /// place circles close to each other using force simulation //////////////        
        d3.forceSimulation(docs)
            .force("x", d3.forceX().strength(0.7).x(d => this.xScale(d.pubYear) + this.xScale.bandwidth()/2))
            .force("y", d3.forceY().strength(0.1).y(d => this.yScale(d.authorName)))
            .force("collide", d3.forceCollide().strength(1).radius(minRadius).iterations(32)) // Force that avoids circle overlapping
            .on("tick", () => authorGroup.selectAll('.doc').attrs({cx: e => e.x, cy: e => e.y}))

            
    }

    drawProfileWave() {
        let countriesPerAuthor = {} 
        this.countDocsPerYear = []
        this.authors.forEach(author => {

            let authorCountries = []
            this.groupedDocs.filter(d => d.authorName === author)
                .forEach(d => authorCountries = authorCountries.concat(d.country))
            authorCountries = authorCountries.filter((d,i) => authorCountries.indexOf(d) === i)
            countriesPerAuthor[author] = authorCountries

            this.dates.forEach(year => {       
                
                let countItems = 0;
                let item = {
                    'year': year,
                    'author': author,
                    'docs': this.groupedDocs.filter(d => d.authorName === author && d.pubYear === year)
                }

                authorCountries.forEach(country => {
                    let res = this.groupedDocs.filter(d => d.authorName === author && d.pubYear === year && d.country.includes(country))

                    item[country] = res.length
                    item.values = res;

                    countItems += res.length
                })
                item[author] = countItems;

                this.countDocsPerYear.push(item)

            })
        })

        this.stack = d3.stack()
            .offset(d3.stackOffsetSilhouette)

        let waveData = this.authors.map(author => {
            const authorData = this.countDocsPerYear.filter(e => e.author === author)
            
            let keys = countriesPerAuthor[author]
            this.stack.keys(keys)
            return {
                'author': author,
                'data' : this.stack(authorData)
            }
        })

        let min = 1000, max = -1000;
        waveData.forEach(d => {
            d.data.forEach(item => {
                item.forEach(e => {
                    let min_e = d3.min(e),
                        max_e = d3.max(e);
                    if (min > min_e) min = min_e;
                    if (max < max_e) max = max_e;
                })
            })
        })

        this.yWave = d3.scaleLinear()
            .domain([min, max])
            .range([-this.yScale.step() * .5, this.yScale.step() *.5]);
        
        this.profileArea = d3.area()
            .x(d =>  this.xScale.bandwidth()/ 2 + this.xScale(d.data.year))
            .y0(d => this.yScale(d.data.author) + this.yWave(d[0]))
            .y1(d => this.yScale(d.data.author) + this.yWave(d[1]))
            .curve(d3.curveMonotoneX)
        
        /// wave ////////
        this.chartGroup.selectAll('g.author')
            .selectAll('g.profile')
            .data(d => waveData.filter(e => e.author === d))
            .join(
                enter => enter.append('g')
                    .classed('profile', true)
                    // .attr('opacity', .8)
                    .call(g => g.selectAll('path')
                        .data(d => d.data)
                        .join('path')
                        .attr('fill', '#f5f5f5')
                        .attr('stroke', '#a3a3a3')
                        .attr("d", this.profileArea)
                    ),
                update => update.call(g => g.select('path').attr("d", this.profileArea)),
                exit => exit.remove()
            )
            .on('mouseenter', d => {
                if (this.freeze_links) return

                let visitedCountries = this.selected_countries.filter(e => e.authors.some(a => a.name === d.key)).map(e => e.alpha3)
               
                this.svg.select('g#map-group').selectAll('path')
                    .style('fill', e => visitedCountries.includes(e.properties.alpha3) ? this.getCountryColor(e) : "#f4f4f4")

                this.svg.selectAll('g.author')
                    .style('opacity', e => e === d.author ? 1 : .2)
                    .filter(e => e === d.author)
                    .selectAll('path')
                    .attr("fill", d => `url(#flag_${d.key})`) 

            }).on('mouseleave', d => {
                if (this.freeze_links) return

                this.svg.select('g#map-group').selectAll('path').style('fill', d => this.getCountryColor(d))

                this.svg.selectAll('g.author').style('opacity', 1)
                    .selectAll('path').attr('fill', '#f5f5f5')

            })
            
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
                        .style('stroke', this.symbol.stroke)
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
                        .style('stroke', this.symbol.stroke)
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
                        .style('stroke', this.symbol.stroke)
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
                    symbolGroup.selectAll('.symbol').style('stroke-width', 1).style('stroke', this.symbol.stroke)
                    
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
            let items = this.data.docs.filter(e => e.authorsList.some(x => x.name === d.source.name) && 
                e.authorsList.some(x => x.name === d.target.name) && e.pubYear === d.year)
            
            let nestedItems = d3.nest().key(e => e.docURI).entries(items)
            return nestedItems.every(e => e.values.length == 1) ? 4 : 'none'
        }

        let headLength = 6
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