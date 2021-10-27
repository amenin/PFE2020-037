
class Timeline {
    constructor () {
        this.country_codes = []
        this.world = {}
        this.selected_countries = []
        this.svg = null
        this.width = null
        this.height = null
        this.margin = { top: 20, right: 100, bottom: 100, left: 100 }
        this.data = null
        this.freeze_links = null
        this.selected_docs = []

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

    init (doctypes) {

        this.loadData()

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
                return doctypes.filter(x => x.code === e)[0]
            })
        })
        
        const div = d3.select('div.vis')

        this.width = div.node().clientWidth;
        this.height = div.node().clientHeight;   
        this.legendHeight = 40

        this.drawLegend()

        this.svg = div.select('svg#chart')
            .attr('transform', `translate(0, ${this.legendHeight})`)
            .attr('width', this.width)
            .attr('height', this.height - this.legendHeight)     

        div.append('div')
            .classed('context-menu', true)

        //// define scales ////
        this.xScale = fisheye.scale(d3.scalePoint)
        this.yScale = fisheye.scale(d3.scalePoint) 

        this.stack = d3.stack().offset(d3.stackOffsetSilhouette)

        this.countryColor = d3.scaleThreshold()
            .range(['#f0f9e8','#bae4bc','#7bccc4','#43a2ca','#0868ac'])

        this.chart = { width: this.width - this.margin.left - this.margin.right, 
                height: this.height - this.margin.top - this.margin.bottom - this.legendHeight, 
                symbolSize : 15}

        this.chartGroup = this.svg.select('g#group-chart')
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
        
        d3.select('body').on('click', function(){
            d3.selectAll('div.context-menu').style('display', 'none')
            if (d3.event.target.className !== 'zoom-control')
                d3.selectAll('div.zoom-div').style('display', 'none')
        })

        this.docRadius = 10
        this.docsSimulation = d3.forceSimulation()
            .force("x", d3.forceX().strength(() => !this.yDistortionAt && this.xDistortionAt ? 0.1 : 0.7).x(d => this.xScale(d.pubYear)))
            .force("y", d3.forceY().strength(() => this.yDistortionAt && !this.xDistortionAt ? 0.1 : (this.xDistortionAt ? 0.7 : 0.3)).y(d => this.yScale(d.authorName)))
            .force("collide", d3.forceCollide().strength(1).radius(() => this.docRadius).iterations(32)) // Force that avoids circle overlapping
            .on("tick", () => this.chartGroup.selectAll('g.author').selectAll('.doc').attrs({cx: e => e.x, cy: e => e.y}))

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
        console.log(data)
        this.data = data;

        // d3.selectAll('div.zoom-div').style('display', 'none')

        if (!Object.keys(data).length) return;

        const updateState = new Promise((resolve, reject) => {

            /// keep only one copy of each relationship
            this.data.links = this.data.links.filter((d,i) => i === this.data.links.findIndex(e => e.year === d.year && 
                ((e.source.name === d.source.name && e.target.name === d.target.name) || 
                (e.source.name === d.target.name && e.target.name === d.source.name))))

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
                .range([0, this.chart.width])
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
            this.setFlagPattern()

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

        const _this = this;
        function pushNode(node, key) {
            let relation = isParent(false, node.children, key) ? "parent" : (node.key === key ? "target" : "children")
            if (!_this.packedLabData[key].some(e => e.key === node.key && e.relation === relation)) {
                // console.log(node)
                node.relation = relation
                node.children = []
                _this.packedLabData[key].push(node)
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
    }

    setFlagPattern(){

        /// keep only information for selected countries /////

        let nestedDataPerCountry = d3.nest()
            .key(d => d.country)
            .entries(this.data.docs)

        // console.log(this.country_codes)
        this.selected_countries = nestedDataPerCountry.map(d => {
            let authors = d.values.map(e => e.authorName)
            authors = authors.filter((d,i) => i === authors.indexOf(d))

            authors = authors.map(e => {
                return {
                    'name': e,
                    'value': d.values.filter(v => v.authorName === e).length
                }
            })
            
            let res = this.country_codes.filter(item => item.name === d.key || item.name.includes(d.key));
            return {
                'country': d.key, 
                'authors': authors,
                'value': d.values.length,
                'alpha3': res.length ? res[0].alpha3 : null,
                'alpha2': res.length ? res[0].alpha2 : null
            }
        })

        let patternWidth = 30,
            patternHeight = 25;

        let defs = this.svg.select('g#flag-pattern-group')
            .selectAll('defs')
            .data(this.selected_countries)
            .join(
                enter => enter.append('defs'),
                update => update,
                exit => exit.remove()
            )

        let pattern = defs.append("pattern")
            .attr("id", d => "flag_" + d.country.replaceAll(' ', '_'))
            .attr("width", patternWidth)
            .attr("height", patternHeight)
            .attr("patternUnits", "userSpaceOnUse")
            .attr('patternTransform', `translate(480,400) scale(1,1)`)

        pattern.append('rect')
            .attr('width', patternWidth)
            .attr('height', patternHeight)
            .attr('fill', '#f5f5f5') 
            
        pattern.append("image")
            .attr("xlink:href", d => `flags/${d.alpha2}.svg`)
            .attr("width", patternWidth)
            .attr("height", patternHeight - 2)
            // .attr('filter', "url(#blur-image)")
            // .attr("x", 5)
            // .attr("y", 2.5)
            // .style('-webkit-filter', 'blur(1px)')
            // .style('opacity', 1)
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
        
        const handleFisheye = (d) => {
            
            if (this.authors.includes(d)) {
                this.yScale.distortion(this.yDistortionAt === d ? 0 : 5).focus(refYScale(d))
                this.svg.select("g#left-axis").call(yAxis)
                this.yTickDistances = getTicksDistance(this.yScale, this.authors)
                this.yDistortionAt = this.yDistortionAt == d ? null : d
            } else {

                if (d3.sum(this.countDocsPerYear.filter(e => this.yDistortionAt ? this.yDistortionAt === e.author && e.year === d : e.year === d), e => e.docs.length) === 0) return;

                this.xScale.distortion(this.xDistortionAt === d ? 0 : 5).focus(refXScale(d))
                this.svg.select("g#bottom-axis").call(xBottomAxis);
                this.svg.select("g#top-axis").call(xTopAxis);
                this.xTickDistances = getTicksDistance(this.xScale, this.dates)
                this.xDistortionAt = this.xDistortionAt === d ? null : d
            }
            
            this.drawProfileWave()
            this.drawEllipses()
            this.drawDocs()
            this.drawLinks()
        }

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

        this.xTickDistances = getTicksDistance(this.xScale, this.dates)
        this.yTickDistances = getTicksDistance(this.yScale, this.authors)

        this.svg.select('g#bottom-axis')
            .attr('transform', `translate(0, ${this.chart.height})`)
            .style('cursor', 'pointer')
            .call(xBottomAxis)
            .selectAll(".tick text")
            .on('click', handleFisheye)

        this.svg.select('g#top-axis')
            .style('cursor', 'pointer')
            .call(xTopAxis)       
            .selectAll(".tick text")
            .on('click', handleFisheye)

        this.leftAxis
            .call(yAxis)
            .selectAll(".tick text")
            .on('click', handleFisheye) 

        let refYScale = d3.scalePoint().domain(this.authors).range([this.chart.height, 0])
        let refXScale = d3.scalePoint().domain(this.dates).range([0, this.chart.width])
        
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
                        // const author_data = authorsInfo.filter(e => e.name === d)[0]
                        // author_data.uri = author_data.uri[0]
                        // fetchData(author_data)
                        // d3.select(this).style('display', 'none')
                    })
            })
            .call(wrap, d => this.getYScaleStep(d) / 2)
       
        this.yDistortionAt = null
        this.xDistortionAt = null

        handleFisheye("Enrico Formenti")

    }

    getXScaleStep(value) {
        return this.xTickDistances[this.dates.indexOf(value)]
    }

    getYScaleStep(value) {
        return this.yTickDistances[this.authors.indexOf(value)]
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
                rx: this.getXScaleStep(d.year) * .5,
                ry: this.yWave(d.height)
            }
        }

        let authorGroup = this.chartGroup.selectAll('g.author')

        // draw one group per author
        let ellipseGroup = authorGroup.selectAll('g.ellipses')
            .data(d => {
                let data = this.ellipseData.filter(e => e.author === d)
                return !this.yDistortionAt ? data : (this.yDistortionAt === d ? data : [])
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
                    .classed('year', true)    
                    .call(g => g.append('ellipse')
                        .attr('fill', 'white')
                        .attr('stroke', '#a3a3a3')
                        .attrs(ellipseAttrs)
                    ),
                update => update.call(g => g.select('ellipse').attrs(ellipseAttrs)),
                exit => exit.remove()
            )
        
        console.log(yearGroup)
        yearGroup.selectAll('ellipse')
            .on('contextmenu', function(d) {
                d3.event.preventDefault()

                let exist = d.docs.some(e => _this.selected_docs.includes(e.docURI))
                if (!exist) return
                let selection = d3.select(this.parentNode)

                const x = d3.event.layerX,
                    y = d3.event.layerY

                d3.select('div.context-menu')
                    .style('left', x + 'px')
                    .style('top', y + 'px')
                    .style('display', 'block')
                    .html(`Go back to documents`)
                    .on('click', () => { 
                        selection.selectAll('.labpack').transition().duration(500).style('opacity', 0).style('display', 'none')
                        selection.selectAll('circle.doc').transition().duration(500).style('opacity', 1).style('display', 'block')
                        selection.selectAll('title.doctitle').remove()
                        let index = _this.selected_docs.indexOf(d.docURI)
                        if (index !== -1) _this.selected_docs.splice(index)
                    })
            })
                        
    }

    drawDocs() {
        const _this = this

        let docsGroup = this.chartGroup.selectAll('g.ellipses').selectAll('g.year')

        const docInfo = d => `About the publication\nIssued on ${d.pubYear}\nTitle: ${d.docTitle}\nType: ${d.docType}\n\nBibliographic Citation: ${d.citation.split('&')[0]}   \n\n--------------------\nAbout the author\nName: ${d.authorName}\nAffiliation(s): ${d.lab.map(lab => lab.name).join('\n\t\t\t')}\nCountry: ${d.country.join(', ')}\n\nClick to go to source`
        
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
            .on('click', d => {
                 window.open(d.hal)
            })
            .on('contextmenu', function(d) { 
                _this.selected_docs.push(d.docURI)

                d3.event.preventDefault()
                const x = d3.event.layerX,
                    y = d3.event.layerY

                d3.select('div.context-menu')
                    .style('left', x + 'px')
                    .style('top', y + 'px')
                    .style('display', 'block')
                    .html(`Explore Research Institutions`)
                    .on('click', () => changeFocus(d3.select(this.parentNode), d))
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

        // replace circles by previously drawn institution packs
        if (this.selected_docs.length) {
            d3.selectAll('circle.doc').filter(d => this.selected_docs.includes(d.docURI)).each(function(d) {
                changeFocus(d3.select(this.parentNode), d)
            })
        }

        function changeFocus(selection, d) {
            selection.selectAll('circle.doc').transition().duration(500).style('opacity', 0).style('display', 'none')
            selection.selectAll('g.labpack').transition().duration(500).style('opacity', 1).style('display', 'block')
            selection.selectAll('ellipse').append('title').classed('doctitle', true).text(`Zoomed at "${d.docTitle}"`)
            _this.drawInstitutionPacks(selection, d)
        }
    }

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
        this.chartGroup.selectAll('g.author')
            .selectAll('g.profile')
            .data(d => this.waveData.filter(e => e.author === d))
            .join(
                enter => enter.append('g')
                    .classed('profile', true)
                    .call(g => g.selectAll('path')
                        .data(d => d.data)
                        .join('path')
                        .attr('fill', '#f5f5f5')
                        .attr('stroke', '#a3a3a3')
                        .attr("d", setProfile)
                    ),
                update => update.call(g => g.selectAll('path')
                    .attr("d", setProfile)),
                exit => exit.remove()
            )
            .on('mouseenter', d => {
                if (this.freeze_links) return

                this.chartGroup.select('g#link-group')
                    .selectAll('g.link')
                    .style('opacity', e => e.source.name === d.author || e.target.name === d.author ? 1 : .1)

                this.svg.selectAll('g.author')
                    .style('opacity', e => e === d.author ? 1 : .2)
                    .filter(e => e === d.author)
                    .selectAll('path')
                    .attr("fill", d => `url(#flag_${d.key.replace(' ', '_')})`) 

            }).on('mouseleave', d => {
                if (this.freeze_links) return

                this.chartGroup.select('g#link-group').selectAll('g.link').style('opacity', 1)

                this.svg.selectAll('g.author').style('opacity', 1)
                    .selectAll('path').attr('fill', '#f5f5f5')

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
        let res = this.selected_countries.filter(e => e.alpha3 === d.properties.alpha3)
        return res.length ? this.countryColor(res[0].value) : "#f4f4f4";
    }

}

