
class Timeline {
    constructor () {
        this.country_codes = []
        this.geo = {}
        this.selected_countries = []
        this.svg = null
        this.width = null
        this.height = null
        this.margin = { top: 20, right: 20, bottom: 20, left: 110 }
        this.data = null
        this.freeze_links = null
        this.selected_item = null

        this.symbol = {mainColor: '#dcdcdc', sndColor: '#7a7a7a', stroke: '#313131'}
    }

    init (data) {

        this.docTypes = [
            {'name': 'Conference Paper', 'values': ['COMM', 'POSTER', 'PRESCONF', 'UNDEFINED']},
            {'name': 'Journal Article', 'values': ['ART']},
            {'name': 'Diploma', 'values': ['ETABTHESE', 'THESE', 'HDR' ]},
            {'name': 'Artwork', 'values': ['MAP', 'PATENT', 'SON', 'VIDEO', 'IMG']},
            {'name': 'Book', 'values': ['OUV', 'COUV', 'DOUV']},
            {'name': 'Gray Knowledge', 'values': ['MEM', 'OTHER', 'OTHERREPORT', 'REPACT', 'REPORT', 'SYNTHESE', 'NOTE', 'MEMLIC']}
        ]
        this.docTypeColor = d3.scaleOrdinal()   
            .domain(this.docTypes.map(d => d.name))
            .range(['#215f92','#4c87a3','#88adb4','#9ecfb6','#96c782','#aeb640'])

        this.docTypes.forEach(d => {
            d.values = d.values.map(e => {
                return data.doctypes.filter(x => x.code === e)[0]
            })
        })
        
        const div = d3.select('div.vis')

        this.legendHeight = 40
        this.width = div.node().clientWidth;
        this.height = div.node().clientHeight - this.legendHeight;   

        this.map = {width: this.width * .3, height: this.height/2}
        this.treemap = {width: this.width * .3, height: this.height/2}

        this.drawLegend()

        this.svg = div.select('svg#chart')
            .attr('transform', `translate(0, ${this.legendHeight})`)
            .attr('width', this.width - this.map.width)
            .attr('height', this.height)     

        this.map.svg = d3.select('svg#geo')
            .style('cursor', 'grab')
            .attr('width', this.map.width)
            .attr('height', this.map.height)
            // .attr('transform', `translate(0, ${this.legendHeight})`)

        this.treemap.svg = d3.select('svg#treemap')
            .attr('width', this.treemap.width)
            .attr('height', this.treemap.height)
            // .attr('transform', `translate(0, ${this.legendHeight + this.map.height})`)

        div.append('div')
            .classed('context-menu', true)

        //// define scales ////
        this.xScale = fisheye.scale(d3.scalePoint)
        this.yScale = fisheye.scale(d3.scalePoint) 

        this.stack = d3.stack().offset(d3.stackOffsetSilhouette)

        // this.countryColor = d3.scaleThreshold()
        //     .range(['#f0f9e8','#bae4bc','#7bccc4','#43a2ca','#0868ac'])

        this.chart = { width: this.width - this.map.width - this.margin.right, 
                height: this.height - this.margin.top - this.margin.bottom - this.legendHeight, 
                symbolSize : 15}

        this.chartGroup = this.svg.select('g#group-chart')
            .attr('transform', `translate(0, ${this.margin.top})`)
        
        d3.select('body').on('click', function(){
            d3.selectAll('div.context-menu').style('display', 'none')
            if (d3.event.target.className !== 'zoom-control')
                d3.selectAll('div.zoom-div').style('display', 'none')
        })

        this.docRadius = 10
        this.docsSimulation = d3.forceSimulation()
            .force("x", d3.forceX().strength(() => !this.yDistortionAt && this.xDistortionAt ? 0.1 : 1).x(d => this.xScale(d.pubYear)))
            .force("y", d3.forceY().strength(() => this.yDistortionAt && !this.xDistortionAt ? 0.1 : (this.xDistortionAt ? 0.7 : 0)).y(d => this.yScale(d.authorName)))
            .force("collide", d3.forceCollide().strength(1).radius(() => this.docRadius).iterations(32)) // Force that avoids circle overlapping
            .on("tick", () => this.chartGroup.selectAll('g.author').selectAll('.doc').attrs({cx: e => e.x, cy: e => e.y}))

        var files = ['data/countries.json', 'data/countries.geojson', 'data/country_per_continent.json'];

        Promise.all(files.map(url => d3.json(url)))
            .then(values => {
                let geodata = values[1]
                geodata.features.forEach(d => {
                    d.properties.alpha3 = d.properties.ISO_A3.toLowerCase()
                    let continent = values[2].find(e => e.Three_Letter_Country_Code === d.properties.ISO_A3)
                    if (continent) {
                        d.properties.continentName = continent.Continent_Name
                        d.properties.continentCode = continent.Continent_Code
                    }
                })

                this.country_codes = values[0]
                this.map.data = geodata

                testVisualization(data)
            })

    }

    drawLegend(){
        let legendSvg = d3.select('svg#color-legend')
            .attr('width', this.width)
            .attr('height', this.legendHeight)

        legendSvg.append('text')
            .text('Types of Documents')
            .attr('transform', `translate(10, 35)`)

        let legendGroup = legendSvg.selectAll('g')
            .data(this.docTypes)
            .enter()
                .append('g')
                .attr('transform', `translate(20, 20)`)
                .style('cursor', 'help')

        let radius = 10, textSize = 170
    
        legendGroup.append('circle')
            .attr('cx', (_,i) => textSize + i * textSize)
            .attr('cy', 10)         
            .attr('r', radius)
            .attr('fill', d => this.docTypeColor(d.name)) 
            
        legendGroup.append('text')
            .attr('x', (_,i) => textSize + radius * 2 + i * textSize)
            .attr('y', 15)
            .text(d => d.name)

        legendGroup.append('title')
            .text(d => 'This category includes: ' + d.values.map(d => d.label)).join(' , ')
    }

    clear() {
        this.svg.selectAll('g').remove()
    }

    update(data) {
        this.data = data;

        // d3.selectAll('div.zoom-div').style('display', 'none')

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
                    'name': d.key, 
                    'authors': authors,
                    'value': d.values.length,
                    'alpha3': res.length ? res[0].alpha3 : null,
                    'alpha2': res.length ? res[0].alpha2 : null
                }
            })

            //////// end filtering selected countries ///////////////////

            // map color code: count of publications per country
            // let values = this.selected_countries.map(d => d.value);
            // let breaks = ss.jenks(values, values.length >= 5 ? 5 : values.length)
            // this.countryColor.domain(breaks)

            ////////////////////////////////////////////////////////////////////////////////

            this.nestedDataPerAuthor = d3.nest()
                .key(function(d) { return d.authorName; })
                .entries(this.data.docs)

            this.nestedDataPerYear = d3.nest()
                .key(d => d.pubYear)
                .sortKeys((a,b) => +a.pubYear - (+b.pubYear))
                .entries(this.data.docs)

            this.authors = this.nestedDataPerAuthor.map(d => d.key)
            
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
                .range([this.margin.left, this.chart.width])
                .padding(.5)
    
            this.yScale.domain(this.authors)
                .range([this.chart.height, 0])
                .padding(.6)

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
                   
                    let labs = doc.values.map(d => { return {'name': d.labName, 'key': d.lab} } )
                    labs = labs.filter((d,i) => i === labs.findIndex(e => e.key === d.key))

                    let docData = JSON.parse(JSON.stringify(doc.values[0]))
                    docData.authorsList = docData.authorsList.map(d => d.name)
                    docData.address = addresses
                    docData.country = countries
                    docData.lab = labs
                    this.groupedDocs.push(docData)
                })
            })

            this.prepareWaveData()
            this.prepareEllipsesData()
            this.prepareLabPacks()

            resolve()
        });

        updateState.then(() => {
            this.draw()
        })
    }

    prepareWaveData(){
        this.countriesPerAuthor = {} 
        this.countDocsPerYear = []
        this.authors.forEach(author => {

            let authorCountries = []
            this.groupedDocs.filter(d => d.authorName === author)
                .forEach(d => authorCountries = authorCountries.concat(d.country))
            authorCountries = authorCountries.filter((d,i) => authorCountries.indexOf(d) === i)
            this.countriesPerAuthor[author] = authorCountries

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

        this.waveData = this.authors.map(author => {
            const authorData = this.countDocsPerYear.filter(e => e.author === author)
            
            let keys = this.countriesPerAuthor[author]
            this.stack.keys(keys)
            return {
                'author': author,
                'data' : this.stack(authorData)
            }
        })

        let min = 1000, max = -1000;
        this.waveData.forEach(d => {
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
    }

    prepareEllipsesData(){
        this.ellipseData = this.authors.map((author,i) => {

            const authorData = this.countDocsPerYear.filter(e => e.author === author)
            this.stack.keys([author])
            let stackedData = this.stack(authorData)[0]

            stackedData = stackedData.map(d => {
                return {
                    'height': d[1],
                    'author': d.data.author,
                    'year': d.data.year,
                    'docs': d.data.docs
                }
                
            })
            
            return {
                'author': author,
                'data' : stackedData.filter(d => d.docs.length) 
            }
        }) 
    }

    prepareLabPacks(){
        function isParent(foundkey, nodes, key){
            if ( !nodes || !nodes.length) return foundkey;

            foundkey = foundkey || nodes.some(d => d.key === key) 
            nodes.forEach(node => foundkey = isParent(foundkey, node.children, key))
            return foundkey
        }

        this.institutionTypes = []
        const pushNode = (node, key) => {
            if (!this.institutionTypes.includes(node.type))
                this.institutionTypes.push(node.type)
            // let relation = isParent(false, node.children, key) ? "parent" : (node.key === key ? "target" : "children")
            if (!this.packedLabData[key].some(e => e.key === node.key)) {
                // console.log(node)
                // node.relation = relation
                node.children = []
                this.packedLabData[key].push(node)
            }
        }

        this.packedLabData = {}
        Object.keys(this.data.trees).forEach(key => {
            this.packedLabData[key] = []
            this.data.trees[key].forEach((d,i) => {
                pushNode(JSON.parse(JSON.stringify(d)), key)

                let children = d.children
                while ( children ) {
                    children.forEach(node => pushNode(JSON.parse(JSON.stringify(node)), key))
                    children = children.children
                }
            })
        })

        
        let last = this.institutionTypes.pop()
        this.institutionTypes.splice(0, 0, last)
        this.institutionTypes.reverse()

        this.institutionColor = d3.scaleOrdinal()
            .domain(this.institutionTypes)
            .range(['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02'])
        
    }

    draw () { 
        

        // create an array with name and uris of authors
        // let authorsURIs = []
        // authors.forEach(author => {
        //     let uris = docs.filter(d => d.authorName === author).map(d => d.authorURI)
        //     uris = uris.filter((d,i) => i === uris.indexOf(d))
        //     authorsURIs.push({
        //         'name': author,
        //         'uri': uris
        //     })            
        // })
       

        //// draw axes

        this.bottomAxis = d3.axisBottom()
            .ticks(this.dates.length)
            .tickFormat(d => d.toString())
            .scale(this.xScale)
        
        this.topAxis = d3.axisTop()
            .ticks(this.dates.length)
            .tickFormat(d => d.toString())
            .scale(this.xScale)
       
        this.svg.select('g#bottom-axis')
            .attr('transform', `translate(0, ${this.chart.height})`)
            .style('cursor', 'pointer')
            .call(this.bottomAxis)
            .selectAll(".tick text")
            .on('click', d => this.handleFisheye(d))

        this.svg.select('g#top-axis')
            .style('cursor', 'pointer')
            .call(this.topAxis)       
            .selectAll(".tick text")
            .on('click', d => this.handleFisheye(d))
       
        this.yDistortionAt = null
        this.xDistortionAt = null

        this.handleFisheye("Enrico Formenti")



    }

    handleFisheye(d) {
        let refYScale = d3.scalePoint().domain(this.authors).range([this.chart.height, 0])
        let refXScale = d3.scalePoint().domain(this.dates).range([0, this.chart.width])
            
        if (this.authors.includes(d)) {
            this.yScale.distortion(this.yDistortionAt === d ? 0 : 5).focus(refYScale(d))
            this.yTickDistances = this.getTicksDistance(this.yScale, this.authors, this.margin.top)
            this.yDistortionAt = this.yDistortionAt == d ? null : d
        } else {

            if (d3.sum(this.countDocsPerYear.filter(e => this.yDistortionAt ? this.yDistortionAt === e.author && e.year === d : e.year === d), e => e.docs.length) === 0) return;

            this.xScale.distortion(this.xDistortionAt === d ? 0 : 5).focus(refXScale(d))
            this.svg.select("g#bottom-axis").call(this.bottomAxis);
            this.svg.select("g#top-axis").call(this.topAxis);
            this.xTickDistances = this.getTicksDistance(this.xScale, this.dates, this.margin.left)
            this.xDistortionAt = this.xDistortionAt === d ? null : d
        }   
        
        this.drawMap()
        this.drawProfileWave()
        
        this.drawEllipses()
        this.drawDocs()
        this.drawLinks()
        this.drawLabels()

        this.drawInstitutionHierarchy(this.selected_item)

        
    }

    getTicksDistance(scale, breaks, axisPosition) {
        const spaces = []
        for(let i=0; i < breaks.length - 1; i++){
            let s1, s2;
            if (breaks[i-1]) {
                s1 = Math.abs(scale(breaks[i]) - scale(breaks[i-1]))
                s2 = Math.abs(scale(breaks[i+1]) - scale(breaks[i]))
                spaces.push(Math.min(s1, s2))
            } else spaces.push(Math.abs(scale(breaks[i+1]) - scale(breaks[i]) - scale.padding()))
        }
        spaces.push(Math.abs(scale(breaks[breaks.length - 1]) - axisPosition) - scale.padding())
        return spaces;
    };

    getXScaleStep(value) {
        return this.xTickDistances ? this.xTickDistances[this.dates.indexOf(value)] : this.xScale.step()
    }

    getYScaleStep(value) {
        return this.yTickDistances ? this.yTickDistances[this.authors.indexOf(value)] : this.yScale.step()
    }

    drawLabels() {

        let breaks = ss.jenks(this.nestedDataPerAuthor.map(d => d.values.length), 7)
        let labelColor = d3.scaleThreshold()
            .domain(breaks)
            .range(['#93adba', '#809cb3', '#748aac', '#7077a1', '#716392', '#744d7e', '#763565', '#741b47'])

        let rectheight = 15
        let labelGroup = this.chartGroup.selectAll('g.author-label')
            .data(this.authors)
            .join(
                enter => enter.append('g')
                    .classed('author-label', true)
                    .attr('transform', d => `translate(10, ${this.yScale(d) - rectheight / 2})`),
                update => update.attr('transform', d => `translate(10, ${this.yScale(d) - rectheight / 2})`),
                exit => exit.remove()
            )

        labelGroup.append('rect')
            .attrs({
                width: d => d.length * 7,
                height: rectheight,
                fill: d => labelColor(this.nestedDataPerAuthor.find(e => e.key === d).values.length) 
            })

        labelGroup.append('text')
            .text(d => d)
            .style('font-weight', 'bold')
            .style('font-size', '12px')
            .attr('dx', '5px')
            .attr('dy', '1em')
            .attr('fill', '#fff')
            .style('cursor', 'pointer')
            .on('mouseenter', d => {
                if (this.freeze_links) return;
                
                let linkElem = this.chartGroup.selectAll('g.link')
                    .style('opacity', e => e.source.name === d || e.target.name === d ? 1 : .02)

                linkElem.selectAll('line').style('stroke-width', 2)

                // highlight documents within line of co-authors
                let targets = this.data.links.filter(e => e.source.name === d || e.target.name === d)
                    .map(e => e.target.name === d ? e.source.name : e.target.name)
                
                    // verify this part of the code, is not working to identify whether both symbols contain both authors 
                let hasAuthor = e => { return e.authorsList.includes(d) && e.authorsList.some(a => targets.includes(a)) }
                let uncertainDoc = e => { return this.groupedDocs.filter(a => a.docURI === e.docURI).length === 1 }

                this.chartGroup.selectAll('.doc')
                    .style('opacity', e => hasAuthor(e) ? 1 : .2)
                    .style('stroke-width', e => hasAuthor(e) ? 2 : 1)
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
                        // const author_data = authorsURIs.filter(e => e.name === d)[0]
                        // author_data.uri = author_data.uri[0]
                        // fetchData(author_data)
                        // d3.select(this).style('display', 'none')
                    })
            })
            .on('click', d => this.handleFisheye(d))
    }

    drawEllipses() {

        // let docs = [];
        const _this = this
        const ellipseAttrs = (d) => {
            let height = this.getYScaleStep(d.author)
            if (!this.yDistortionAt) height /= 2
            this.yWave.range([-height, height]);
            
            return {
                cx: this.xScale(d.year),
                cy: this.yScale(d.author),
                rx: this.getXScaleStep(d.year) * .4,
                ry: this.yWave(d.height)
            }
        }

        let authorGroup = this.chartGroup.selectAll('g.author')

        // draw one group per author
        let ellipseGroup = authorGroup.selectAll('g.ellipses')
            .data(d => {
                let data = this.ellipseData.filter(e => e.author === d)
                return this.yDistortionAt === d ? data : []
            })
            .join(
                enter => enter.append('g')
                    .classed('ellipses', true),
                update => update,
                exit => exit.remove()
            )
       
        // draw one group and one ellipse per year
        let yearGroup = ellipseGroup.selectAll('g.year')
            .data(d => this.xDistortionAt ? d.data.filter(e => e.year === this.xDistortionAt) : d.data)
            .join(
                enter => enter.append('g')
                    .classed('year', true),
                    // .call(g => g.append('ellipse')
                    //     .attr('fill', 'white')
                    //     .attr('stroke', '#a3a3a3')
                    //     .attrs(ellipseAttrs)
                    // ),
                update => update.call(g => g.select('ellipse').attrs(ellipseAttrs)),
                exit => exit.remove()
            )
        
        yearGroup.append('title')
            .text(d => d.docs.length + ' items:\n' + d.docs.map(e => `- ${e.docTitle} (${e.docType})`).join('\n'))

        // yearGroup.on('contextmenu', function(d) {
        //         d3.event.preventDefault()

        //         let exist = d.docs.some(e => _this.selected_docs.includes(e.docURI))
        //         if (!exist) return
        //         let selection = d3.select(this.parentNode)

        //         const x = d3.event.layerX,
        //             y = d3.event.layerY

        //         d3.select('div.context-menu')
        //             .style('left', x + 'px')
        //             .style('top', y + 'px')
        //             .style('display', 'block')
        //             .html(`Go back to documents`)
        //             .on('click', () => { 
        //                 selection.selectAll('.labpack').transition().duration(500).style('opacity', 0).style('display', 'none')
        //                 selection.selectAll('circle.doc').transition().duration(500).style('opacity', 1).style('display', 'block')
        //                 selection.selectAll('title.doctitle').remove()
        //                 let index = _this.selected_docs.indexOf(d.docURI)
        //                 if (index !== -1) _this.selected_docs.splice(index)
        //             })
        //     })
                        
    }

    drawDocs() {
        const _this = this

        let docsGroup = this.chartGroup.selectAll('g.ellipses').selectAll('g.year')

        const docInfo = d => `${d.docTitle} (${d.docType})\nClick to go to source`
        
        const docFill = d => {
            let item = this.docTypes.find(e => e.values.some(x => x.code === d.docTypeCode))
            return this.docTypeColor(item.name)
        }

        let res;
        if (this.xDistortionAt && this.yDistortionAt) {
            res = this.ellipseData.find(d => d.author === this.yDistortionAt).data.find(d => d.year === this.xDistortionAt)
        } else if (this.yDistortionAt) {
            res = this.ellipseData.find(d => d.author === this.yDistortionAt)
        } else if (this.xDistortionAt) {
            res = this.ellipseData.reduce( (a, b) => { 
                let b_value = b.data.find(e => e.year === this.xDistortionAt),
                    a_value = a.data.find(e => e.year === this.xDistortionAt)
                if (!b_value) return a
                if (!a_value) return b
                return (b_value.height < a_value.height) ? b : a
            })
            res = res.data.find(d => d.year === this.xDistortionAt)
        } else {
            res = this.ellipseData.reduce( (a, b) => (d3.min(b.data, d => d.height) < d3.min(a.data, d => d.height)) ? b : a)
        }
        
        let height = this.getYScaleStep(res.author) / 2
        this.yWave.range([-height, height]);

        // narrowest wave
        height = this.xDistortionAt || (this.yDistortionAt && this.xDistortionAt) ? res.height : d3.min(res.data, d => d.height)
        
        this.docRadius = (this.yDistortionAt && this.xDistortionAt) ? this.yWave(height) / res.height : this.yWave(height)
        this.docRadius *= height <= 0.5 ? 1.8 : .85

        let docs = []
        
        docsGroup.selectAll('g.labpack').remove()
        // draw the documents inside each ellipse
        docsGroup.selectAll('circle.doc')
            .data(d => { 
                docs = docs.concat(d.docs); 
                return d.docs; 
            })
            .join(
                enter => enter.append('circle')
                    .attr('stroke', 'none')
                    .classed('doc', true)
                    .attr('fill', docFill)
                    .attr('r', this.docRadius)
                    .call(circle => circle.append('title').text(docInfo)),
                update => update.attr('fill', docFill)
                    .attr('r', this.docRadius)
                    .style('display', 'block')
                    .style('opacity', 1)
                    .call(circle => circle.select('title').text(docInfo)),
                exit => exit.remove()        
            )
            .on('contextmenu', function(d) { 

                d3.event.preventDefault()
                const x = d3.event.layerX,
                    y = d3.event.layerY

                d3.select('div.context-menu')
                    .style('left', x + 'px')
                    .style('top', y + 'px')
                    .style('display', 'block')
                    .html(`Go to Source`)
                    .on('click', () => window.open(d.hal))
            })
            .on('click', d => {
                if (this.selected_item === d) return

                this.selected_item = d
                this.drawInstitutionHierarchy(d)
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
          
        /// place circles close to each other using force simulation //////////////  
        this.docsSimulation.nodes(docs)
        this.docsSimulation.force('y').initialize(docs)      
        this.docsSimulation.force('x').initialize(docs)
        this.docsSimulation.force('collide').initialize(docs)
        this.docsSimulation.alpha(0.5).alphaTarget(0.3).restart();

    }

    drawInstitutionHierarchy(doc) {
        if (!doc) {
            if (!this.treemap.svg.selectAll('text.info').size())
                this.treemap.svg.append('text')
                    .classed('info', true)
                    .style('text-anchor', 'middle')
                    .attr('x', this.treemap.width / 2)
                    .attr('y', this.treemap.height / 2)
                    .text('Click on a document to display the institution hierarchy.')

            return
        }

        this.treemap.svg.selectAll('text.info').remove()

        let data = {children: []}
        doc.lab.forEach(d => {
            let labData = this.packedLabData[d.key]    
            labData.forEach(e => e.selected = e.key === d.key)
            data.children.push({"name": labData[0].country, "children": labData})
        })


        let root = d3.hierarchy(data)
            .sum(d => d.type ? this.institutionTypes.indexOf(d.type) + 1 : 0)
            .sort((a,b) => b.value - a.value)

        d3.treemap()
            .size([this.treemap.width, this.treemap.height - 20])
            .paddingTop(25)
            .paddingRight(7)
            .paddingInner(3)
            (root)

        let rectAttrs = { width: d => d.x1 - d.x0, height: d => d.y1 - d.y0, 
                fill: d => d.data.type ? this.institutionColor(d.data.type) : '#f5f5f5', 
                'stroke-width': d => d.data.selected ? 2 : 1, 
                stroke: '#000'},
            titleText = d => { return d.data.strAcro || (d.data.name.split('/').length > 1 ? d.data.name.split('/')[1] : d.data.name.trim()) },
            subtitleText = d => { return d.data.type.match(/[A-Z][a-z]+/g).filter(e => !['Structure', 'Type'].includes(e)).join(' ') },
            wrapText = function(d) { wrap_ellipsis(d3.select(this), d.x1 - d.x0)},
            tooltipText = d => { return `${d.data.name} (${subtitleText(d)})` }
        
        this.treemap.svg.selectAll('g')
            .data(root.leaves())
            .join(
                enter => enter.append('g')
                    .call(g => g.append('rect')
                        .attrs(rectAttrs))
                    .call(g => g.append('text')
                        .attr('font-size', '12px')
                        .attr('fill', 'black')
                        .attrs({ x: 2, y: 8, dy: '.2em' })
                        .classed('titles', true)
                        .text(titleText)
                        .each(wrapText))
                    .call(g => g.append('text')
                        .attr('font-size', '9px')
                        .classed('subtitles', true)
                        .attrs({ x: 2, y: 20 })
                        .text(subtitleText)
                        .each(wrapText))
                    .call(g => g.append('title')
                        .text(tooltipText)),
                update => update
                    .call(g => g.select('rect').transition().duration(500).attrs(rectAttrs))
                    .call(g => g.select('text.titles').text(titleText).each(wrapText))
                    .call(g => g.select('text.subtitles').text(subtitleText).each(wrapText))
                    .call(g => g.select('title').text(tooltipText)),
                exit => exit.remove()
            )
            .attr('transform', d => `translate(${d.x0}, ${d.y0})`)
    
        // labels on groups of rectangles (countries)
        let titleAttrs = { x: d => d.x0, y: d => d.y0 + 21 }
        this.treemap.svg.selectAll('.group-titles')
            .data(root.descendants().filter(d => d.depth === 1))
            .join(
                enter => enter.append('text')
                    .classed('group-titles', true)
                    .attr('font-size', '19px'),
                update => update,
                exit => exit.remove()
            )
            .text(d => d.data.name)
            .attrs(titleAttrs)

        this.treemap.svg
            .on('mouseenter', () => {
                
                this.svg.selectAll('.doc')
                    .style('stroke', d => d.docURI === doc.docURI ? '#000' : 'none')
                    .style('stroke-width', d => d.docURI === doc.docURI ? 2 : 1)
            })
            .on('mouseleave', () => {
                this.svg.selectAll('.doc')
                    .style('stroke', 'none')
                    .style('stroke-width', 1)
            })

        
    }

    // modify this function to display children of circles (like songs of an album)
    drawInstitutionPacks(group, doc){
        
        // let radius = this.getXScaleStep(doc.pubYear)
        const pack = d3.pack()
            .size([this.docRadius * 2, this.docRadius * 2])
            .padding(3)

        let colorScale = d3.scaleOrdinal(d3.schemeAccent)

        let radiusScale = d3.scaleOrdinal()
            .domain(['parent', 'target', 'children'])
            .range([6, 15, 3])
            
        let packGroup = group.selectAll('g')
            .data(doc.lab)
            .join(
                enter => enter.append('g')
                    .classed('labpack', true),
                update => update,
                exit => exit.remove()
            )

        packGroup.append('image')
            .attr('width', this.docRadius * 2.1)
            .attr('height', this.docRadius * 2.1)
            .attr('transform', `translate(-0.5, -0.5)`)
            .attr("xlink:href", d => {
                let labData = this.packedLabData[d.key]
                let country = labData[0].country
                let res = this.country_codes.find(e => e.name === country || e.name.includes(country))
                return res ? `flags/${res.alpha2}.svg` : null
            })
        
        packGroup.selectAll('circle')
            .data(lab => {
                let labData = this.packedLabData[lab.key]
                
                const root = d3.hierarchy({"name": labData[0].country, "children": labData})
                    .sum(d => radiusScale(d.relation))
                    .sort((a,b) => b.value - a.value)

                pack(root)
                return root.descendants()
            })
            .join(
                enter => enter.append('circle')
                    .attrs({
                        cx: d => d.x,
                        cy: d => d.y,
                        r: d => d.r
                    }) 
                    .attr('fill', d => d.data.type ? colorScale(d.data.type) : '#f5f5f5')
                    .attr('stroke', function(d) {
                        let parentData = d3.select(this.parentNode).datum()
                        return parentData.key === d.data.key ? '#000' : 'none'
                    })
                    .call(circle => circle.append('title')
                        .text(d => d.data.name + (d.data.type ? ' (' + d.data.type.replace('StructureType', '') + ')' : ''))),
                update => update.attr('fill', d => d.data.type ? colorScale(d.data.type) : `#f5f5f5`)
                    .attr('stroke', function(d) {
                        let parentData = d3.select(this.parentNode).datum()
                        return parentData.key === d.data.key ? '#000' : 'none'
                    })
                    .call(circle => circle.select('title')
                        .text(d => d.data.name + (d.data.type ? ' (' + d.data.type.replace('StructureType', '') + ')' : ''))),
                exit => exit.remove()
            )

        
        
        d3.forceSimulation(doc.lab)
            .force("x", d3.forceX().strength(!this.yDistortionAt && this.xDistortionAt ? 0.1 : 0.8)
                .x(this.xScale(doc.pubYear)))
            .force("y", d3.forceY().strength(this.yDistortionAt && !this.xDistortionAt ? 0.1 : (this.xDistortionAt ? 0.7 : 0.3)) 
                .y(this.yScale(doc.authorName)))
            .force("collide", d3.forceCollide().strength(1).radius(this.docRadius * 1.2).iterations(32)) // Force that avoids circle overlapping
            .on("tick", () => packGroup.attr('transform', e => `translate(${e.x - this.docRadius}, ${e.y - this.docRadius})`))    
    }

    drawProfileWave() {
        const _this = this;

        let colorScale = d3.scaleOrdinal()
            .range(['#f5f5f5', '#ededed', '#e5e5e5', '#dddddd', '#d6d6d6', '#cecece', '#c6c6c6', '#b5b5b5', '#a4a4a4', '#939393', '#828282', '#727272', '#626262'])

        let profileArea = d3.area()
            .x(d => this.xScale(d.data.year))
            .y0(d => this.yScale(d.data.author) + (!this.yDistortionAt || this.yDistortionAt === d.data.author ? this.yWave(d[0]) : 0))
            .y1(d => this.yScale(d.data.author) + (!this.yDistortionAt || this.yDistortionAt === d.data.author ? this.yWave(d[1]) : 0))
            .curve(d3.curveMonotoneX)

        function setProfile(d) {
            let parentData = d3.select(this.parentNode).datum()
            let height = _this.getYScaleStep(parentData.author)
            if (!_this.yDistortionAt) height /= 2
            _this.yWave.range([-height, height]);
            return profileArea(d)
        }
        
        /// wave ////////
        let waveGroup = this.chartGroup.selectAll('g.author')
            .selectAll('g.profile')
            .data(d => this.waveData.filter(e => e.author === d))
            .join(
                enter => enter.append('g')
                    .classed('profile', true),
                update => update.call(g => g.selectAll('path')
                    .attr("d", setProfile)),
                exit => exit.remove()
            )


        waveGroup.selectAll('path')
            .data(d => d.data)
            .join('path')
            .attr('fill', d => colorScale(d.key))
            .attr('stroke', '#a3a3a3')
            .attr("d", setProfile)    
            .on('mouseenter', d => {
                if (this.yDistortionAt) return

                this.chartGroup.select('g#link-group')
                    .selectAll('g.link')
                    .style('opacity', e => e.source.name === d.author || e.target.name === d.author ? 1 : .1)
                
                waveGroup.selectAll('path')
                    .style('opacity', e => e.key === d.key ? 1 : .2) 


                d3.select('svg#geo').selectAll('path.polygon')
                    .style('fill', e => e.properties.ADMIN === d.key ? "#1B4774" : '#f5f5f5')

            }).on('mouseleave', d => {
                if (this.yDistortionAt) return

                this.chartGroup.select('g#link-group').selectAll('g.link').style('opacity', 1)

                waveGroup.selectAll('path')
                    .style('opacity', 1)

                d3.select('svg#geo').selectAll('path.polygon')
                    .style('fill', d => this.getCountryColor(d))

            })
            
    }

    drawLinks() {
        ///------------------------------------------------------------------------------------------------------------------------------------
        //// co-authorship links ////////////

        const linksGroup = this.chartGroup.select('g#link-group')

        const lineAttrs = { x1: d => this.xScale(d.year),
            x2: d => this.xScale(d.year),
            y1: d => this.yScale(d.source.name),
            y2: d => this.yScale(d.target.name)
        }

        const xTicks = {
            x1: d => this.xScale(d.year) - headLength/2,
            x2: d => this.xScale(d.year) + headLength/2     
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
        if (this.yDistortionAt && this.countriesPerAuthor[this.yDistortionAt].includes(d.properties.ADMIN)) return '#1B4774' 
        else if (!this.yDistortionAt && this.selected_countries.some(x => x.alpha3 === d.properties.alpha3)) return '#1B4774' 
        return '#f5f5f5'   
        // let res = this.selected_countries.filter(e => e.alpha3 === d.properties.alpha3)
        // return res.length ? this.countryColor(res[0].value) : "#f4f4f4";
    }

    drawMap () {           

        const _this = this
        const accent = d3.scaleOrdinal(d3.schemeAccent);

        // const drag = d3.drag()
        //     .on("start", dragstarted)
        //     .on("drag", dragged)

        // this.map.svg.call(drag)

        ///// world map ////////////
        const projection = d3.geoOrthographic()
            .scale(200)
            .translate([this.map.width/2, this.map.height/2])
            .rotate([ -3.0827457688710598, -30.46385623276532, -0.7224498702519475 ])

        let path = d3.geoPath().projection(projection)

        this.map.svg.selectAll('path.polygon')
            .data(this.map.data.features)
            .join(
                enter => enter.append('path')   
                    .classed('polygon', true)
                    .attr('d', path)
                    .style('fill', d => this.getCountryColor(d))
                    .style('stroke', '#888')
                    .style('stroke-width', '1px')
                    .style('opacity', 0.8)
                    .style('stroke-width', 0.3)
                    .call(path => path.append('title')
                        .text(d => `${d.properties.ADMIN} (${d.properties.continentName})`)),
                update => update.style('fill', d => this.getCountryColor(d)),
                exit => exit.remove()   
            )           
            .on('mouseenter', d => {
                if (this.yDistortionAt) return;

                let country = this.selected_countries.find(x => x.alpha3 === d.properties.alpha3)
                if (!country) return;
               
                d3.selectAll('g.author').selectAll('path')
                    .style('opacity', e => country.name === e.key ? 1 : .1)

                let validAuthors = country.authors.map(e => e.name)
                d3.selectAll('g.ellipses').style('opacity', e => validAuthors.includes(e.author) ? 1 : .1)
            })
            .on('mouseleave', () => {
                if (this.yDistortionAt) return;

                d3.selectAll('g.author').selectAll('path').style('opacity', 1)
                d3.selectAll('g.ellipses').style('opacity', 1)
            })

        const graticule = d3.geoGraticule().step([10, 10]);

        if (!this.map.svg.selectAll('path.graticule').size()) {
            this.map.svg.append("path")
                .datum(graticule)
                .attr("class", "graticule")
                .attr("d", path)
                .style("fill", "none")
                .style("stroke", "#ccc");
        }

        const sensitivity = 75
        const initialScale = projection.scale()
        this.map.svg
            .call(d3.drag().on('drag', function() {
                const rotate = projection.rotate()
                const k = sensitivity / projection.scale()
                projection.rotate([
                    rotate[0] + d3.event.dx * k,
                    rotate[1] - d3.event.dy * k
                ])
                path = d3.geoPath().projection(projection)
                d3.select(this).selectAll("path").attr("d", path)
            }))
            .call(d3.zoom().on('zoom', function() {
                if(d3.event.transform.k > 0.3) {
                    projection.scale(initialScale * d3.event.transform.k)
                    path = d3.geoPath().projection(projection)
                    d3.select(this).selectAll("path").attr("d", path)
                }
                else {
                    d3.event.transform.k = 0.3
                }
          }))

        //// drag functions //////////////
        /// see why the drag and drop is so slow
        // var gpos0, o0;
        // function dragstarted() {
        //     gpos0 = projection.invert(d3.mouse(this));
        //     o0 = projection.rotate();
        // }
        
        // function dragged() {
        //     var gpos1 = projection.invert(d3.mouse(this));
        //     o0 = projection.rotate();
        //     var o1 = eulerAngles(gpos0, gpos1, o0);
        //     projection.rotate(o1);
        //     d3.select(this).selectAll("path").attr("d", path);
        // }

        ///////// end drag functions ////////////////////////////////////////////   
    }

}

