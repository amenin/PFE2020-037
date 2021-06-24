import React, { Component } from 'react'

import * as d3 from 'd3'
import { geoRobinson } from 'd3-geo-projection'
import { jenks } from 'simple-statistics'

import '../style/timeline.css'

class Timeline extends Component {
    constructor (props) {
        super(props)

        this.state = {
            country_codes: [],
            world: {},
            selected_countries: []    
        };

        this.createTimeline = this.createTimeline.bind(this)
    }

    shouldComponentUpdate (nextProps, nextState) {
        return this.props.data !== nextProps.data
    }

    componentDidMount() {
        var files = ['/data/countries_fr.json', '/data/countries.geojson'];

        Promise.all(files.map(url => d3.json(url)))
        .then(values => {
            let worldData = values[1]
            worldData.features.forEach(d => {
                d.properties.alpha3 = d.properties.ISO_A3.toLowerCase()
            })

            this.setState({country_codes: values[0], world: worldData});

            const buttons = [{'icon': '🗘', 'row': 0, 'col': 5, 'value': 'reset', 'action': 'reset'},
                {'icon': '+', 'row': 0, 'col': 3, 'value': 'plus', 'action': 'zoom'},
                {'icon': '-', 'row': 0, 'col': 4, 'value': 'minus', 'action': 'zoom'},
                {'icon': '>', 'row': 1, 'col': 0, 'value': 'right', 'action': 'pan'},
                {'icon': '<', 'row': 1, 'col': 2, 'value': 'left', 'action': 'pan'},
                {'icon': '>', 'row': 0, 'col': 1, 'value': 'up', 'action': 'pan'},
                {'icon': '<', 'row': 2, 'col': 1, 'value': 'down', 'action': 'pan'}]

            const div = d3.select(this.node.parentNode)
            div.selectAll('button.zoom-control')
                .data(buttons)
                .enter()
                    .append('button')
                    .classed('zoom-control', true)
                    .style('transform', d => ['up', 'down'].includes(d.value) ? 'rotate(-90deg)' : null)
                    .text(d => d.icon)           

            div.append('div')
                .classed('context-menu', true)

        })
        .catch(function(error) { throw(error); })
    }   
    
    componentDidUpdate() {
        d3.select(this.node).selectAll('g').remove()
        d3.select(this.node.parentNode).selectAll('button.zoom-control').style('display', 'none')

        if (!Object.keys(this.props.data).length) return;

        const updateState = new Promise((resolve, reject) => {

            let nestedData = d3.nest()
                .key(function(d) { return d.country; })
                .sortKeys((a,b) => a.localeCompare(b))
                .entries(this.props.data.docs)
    
            /// keep only information for selected countries /////
            let validCountries = nestedData.map(d => {
                let authors = d.values.map(e => e.author)
                authors = authors.filter((d,i) => i === authors.indexOf(d))
    
                authors = authors.map(e => {
                    return {
                        'name': e,
                        'value': d.values.filter(v => v.author === e).length
                    }
                })
    
                let res = this.state.country_codes.filter(item => item.name === d.key);
                return {
                    'country': d.key, 
                    'authors': authors,
                    'value': d.values.length,
                    'alpha3': res.length ? res[0].alpha3 : null,
                    'alpha2': res.length ? res[0].alpha2 : null
                }
            })
    
            this.setState({country_codes: this.state.country_codes, world: this.state.world, selected_countries: validCountries})
            resolve()
        });

        updateState.then(() => {
            this.createImagePatterns()
            this.createTimeline()
        })
        
    }
 
    createImagePatterns(){
        let countryCodes = this.state.selected_countries;

        // d3.select('g#patterns-group').remove()

        var defs = d3.select(this.node)
            .append('g')
            .attr('id', 'patterns-group')
            .selectAll('defs')
            .data(countryCodes)
            .enter()
                .append('defs')

        defs.append("pattern")
            .attr("id", d => "flag_" + d.alpha2)
            .attr("width", 1)
            .attr("height", 1)
            .attr('viewBox', "0 0 100 100")
            .attr('preserveAspectRatio', 'none')
                .append("svg:image")
                .attr("xlink:href", d => `${process.env.PUBLIC_URL}/flags/${d.alpha2}.svg`)
                .attr("width", 100)
                .attr("height", 100)
                .attr('preserveAspectRatio', 'none')
    }

    createTimeline () {
        
        let data = this.props.data.docs,
            countryCodes = this.state.selected_countries,
            links = this.props.data.links,
            world = this.state.world,
            changeFocus = this.props.retrieveData;

        const controls = {freeze_links: null}
        
        links = links.filter((d,i) => i === links.findIndex(e => e.source == d.source && e.target === d.target && e.year === d.year))

        let nestedData = d3.nest()
            .key(function(d) { return d.author; })
            .sortKeys((a,b) => a.localeCompare(b))
            .entries(data)

        const nestedDocsbyAuthor = d3.nest()
            .key(d => d.author)
            .key(d => d.docURI)
            .sortKeys((a,b) => a.localeCompare(b))
            .entries(data)

        // group different countries, adresses and labs per document and author
        let docs = []
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
                docs.push(docData)
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
        const symbol = {color: '#cab609', stroke: '#666666'}

        let nestedDataByyear = d3.nest()
            .key(d => d.year)
            .entries(docs)
        let maxHeight = d3.max(nestedDataByyear, d => d.values.length) / 3
        maxHeight = 20 * maxHeight > 200 ? 20 * maxHeight : 200;

        const authors = nestedData.map(d => d.key)

        // create an array with name and uris of authors
        let authorsInfo = []
        authors.forEach(author => {
            let uris = data.filter(d => d.author === author).map(d => d.authorURI)
            uris = uris.filter((d,i) => i === uris.indexOf(d))
            authorsInfo.push({
                'name': author,
                'uri': uris
            })            
        })
        
        const margin = { top: 100, right: 0, bottom: 100, left: 100 },
            width = this.node.parentNode.clientWidth - margin.left - margin.right,
            chart = { width: width * .95, height: maxHeight * authors.length, symbolSize: 15 };

        if (chart.height + 150 > this.node.parentNode.clientHeight)
            this.node.parentNode.style.height = chart.height + 150 + 'px';
        
        const svg = d3.select(this.node)
            .attr('height', this.node.parentNode.clientHeight)
           
        // svg.select('g#group-chart').remove()

        createMap(this)

        const chartGroup =  svg.append('g')
            .attr('id', 'group-chart')
            .attr('transform', `translate(${margin.left}, ${margin.top})`)

        ///// axes ////////////////
        const yScale = d3.scalePoint()
            .domain(authors)
            .range([chart.height, 0])
            .padding(0.5)

        const yAxis = d3.axisLeft()
            .scale(yScale)
        
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

        chartGroup.append('g')
            .attr('transform', `translate(0, ${chart.height})`)
            .call(xAxis)
        
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
                    .style('opacity', e => e.source === d ? 1 : .1)

                linkElem.selectAll('line').style('stroke-width', '2')

                // highlight documents within line of co-authors
                let targets = links.filter(e => e.source === d).map(e => e.target)

                let symbolGroup = chartGroup.selectAll('g.symbol-group').filter(e => e.authorsList.includes(d) && e.authorsList.some(a => targets.includes(a)))
                symbolGroup.selectAll('.symbol')
                    .style('stroke', '#000')
                    .style('stroke-width', 2)
    
                symbolGroup.selectAll('.symbol').filter(e => docs.filter(a => a.docURI === e.docURI).length == 1).style('stroke-dasharray', 4)
            })
            .on('mouseleave', () => {
                if (controls.freeze_links) return;
                chartGroup.selectAll('g.link')
                    .style('opacity', 1)
                    .selectAll('line')
                    .style('stroke-width', 1)

                let symbolGroup = chartGroup.selectAll('g.symbol-group')
                symbolGroup.selectAll('.symbol')
                    .style('stroke', symbol.stroke)
                    .style('stroke-width', 1)
                    .style('stroke-dasharray', 'none')
            })
            .on('click', function(d) {
                if (controls.freeze_links && controls.freeze_links != d) return;

                controls.freeze_links = d === controls.freeze_links ? null : d;
                
                d3.select(this).style('color', d => controls.freeze_links ? '#8e8e8e' : '#000')
            })
            .on('contextmenu', d => {
                d3.event.preventDefault()
                const x = d3.event.layerX,
                    y = d3.event.layerY

                d3.select('div.context-menu')
                    .style('left', x + 'px')
                    .style('top', y + 'px')
                    .style('display', 'block')
                    .html(`Reload and Focus on ${d}`)
                    .on('click', function() {
                        changeFocus(authorsInfo.filter(e => e.name === d)[0])
                        d3.select(this).style('display', 'none')
                    })
            })
            .call(wrap, yScale.step()/2)

        function wrap(text, width) {
            text.each(function() {
                var text = d3.select(this),
                    words = text.text().split(/\s+/).reverse(),
                    word,
                    line = [],
                    lineNumber = 0,
                    lineHeight = 1.1, // ems
                    y = text.attr("y"),
                    dy = parseFloat(text.attr("dy")),
                    tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if (tspan.node().getComputedTextLength() > width) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
        }

        ///// grids ////////////////////////////
        const gridGroup = chartGroup.append('g')
            .classed('grid', true)

        gridGroup.selectAll('line.vert')
            .data(dates)
            .enter()
                .append('line')
                .attr('y1', chart.height)
                .attr('x1', d => xScale(d))
                .attr('y2', 0)
                .attr('x2', d => xScale(d))
                .style('stroke-width', 1)
                .style('stroke', '#ccc')
                .style('stroke-dasharray', 3)

        gridGroup.selectAll('line.hori')
            .data(authors)
            .enter()
                .append('line')
                .attr('y1', d => yScale(d))
                .attr('x1', 0)
                .attr('y2', d => yScale(d))
                .attr('x2', chart.width)
                .style('stroke-width', 1)
                .style('stroke', '#ccc')
                .style('stroke-dasharray', 3)

        ///// authors ///////////////////////  

        ///// wave //////

        //// create complete dataset with missing years for each author accorging to "dates" ///
        nestedData = nestedData.map(d => {
            return {
                'values': d3.nest().key(e => e.year).entries(d.values),
                'key': d.key
            }
        })

        let dataPerYear = []
        authors.forEach(author => {
            dates.forEach(year => {
                if (!dataPerYear.some(x => x.key === year && x.author === author)){
                    let res = nestedData.filter(d => d.key === author)[0].values.filter(d => d.key === year)
                    dataPerYear.push({
                        'year': year,
                        'author': author,
                        'values': res.length ? res[0].values : []
                    })
                }
            })

            dataPerYear.forEach(e => {
                e[author] = e.values.length
            })
        })
        
        dataPerYear.sort((a,b) => +a.year - (+b.year))

        /// author wave profile //////////////
        const yWave = d3.scaleLinear()
            .domain([-2, 2])
            .range([ yScale.step() * .05, -yScale.step() * .05 ]);
        
        const stack = d3.stack()
            .offset(d3.stackOffsetSilhouette)

        const area = d3.area()
            .x(function(d, i) { return xScale.bandwidth()/ 2 + xScale(d.data.year); })
            .y0(function(d) { return yScale(d.data.author) - yWave(d[0]); })
            .y1(function(d) { return yScale(d.data.author) - yWave(d[1]); })
            .curve(d3.curveMonotoneX)
        
        /// author group /////////
        const authorGroup = chartGroup.selectAll('g.node')
            .data(nestedData)
            .enter()
                .append('g')

        /// wave ////////
        const profileGroup = authorGroup.append('g')
            .classed('profile', true)

        profileGroup.selectAll("path")
            .data(d => {
                stack.keys([d.key])
                return stack(dataPerYear.filter(e => e.author === d.key))
            })
            .enter()
                .append("path")
                .style("fill", '#a3a3a3')
                .attr("d", area)
                .style('opacity', 0.5)
                .on('mouseenter', d => {
                    let k = d3.zoomTransform(d3.select('g.countries').selectAll('path').node()).k
                    let visitedCountries = countryCodes.filter(e => e.authors.some(a => a.name === d.key))

                    svg.select('g#map-group').selectAll('path')
                        .style('stroke-width', d => visitedCountries.some(e => e.alpha3 === d.properties.alpha3) ? 1.5 / k : .3)
                        .style('stroke', d => visitedCountries.some(e => e.alpha3 === d.properties.alpha3) ? '#000' : '#ccc')

                }).on('mouseleave', d => {
                    svg.select('g#map-group').selectAll('path').style('stroke-width', '.3').style('stroke', '#ccc')
                })

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
            .attr('y1', d => yScale(d.source))
            .attr('y2', d => yScale(d.target))
            .style('stroke', '#000')

        lines.filter(d => {
            let items = docs.filter(e => e.authorsList.includes(d.source) && e.authorsList.includes(d.target) && e.year === d.year)
            let nestedItems = d3.nest().key(e => e.docURI).entries(items)
            return nestedItems.every(e => e.values.length == 1)
        })
        .style('stroke-dasharray', 4)

        link.append('circle')
            .attr('r', '3')
            .attr('cx', d => xScale.bandwidth()/ 2 + xScale(d.year))
            .attr('cy', d => yScale(d.source))   
            .style('fill', '#000')
            
        link.append('circle')
            .attr('r', '3')
            .attr('cx', d => xScale.bandwidth()/ 2 + xScale(d.year))
            .attr('cy', d => yScale(d.target))   
            .style('fill', '#000')


        /// publications per author, year and type ///////////////
        
        // group of documents
        const docsGroup = chartGroup.append('g')

        // group per symbol (some symbols include more than one info)
        const symbolGroup = docsGroup.selectAll('g')
                .data(docs)
                .enter()
                    .append('g')
                    .classed('symbol-group', true)
                    .style('cursor', 'pointer')
                    .on('click', d => {
                        window.open(d.docURI)
                    })

        // squares for conference, diplome and artistic/technical documents
        symbolGroup.filter(d => !docTypes.gray.includes(d.docTypeCode))
            .append('rect')
            .attr('width', chart.symbolSize)
            .attr('height', chart.symbolSize)
            .attr('fill', '#fff')
            .style('stroke', symbol.stroke)
            .classed('symbol', true)

        // whole books and editions
        symbolGroup.filter(d => docTypes.book.includes(d.docTypeCode))
            .selectAll('rect')
            .attr('width', chart.symbolSize * 1.5) 
            .attr('fill', d => ['OUV', 'BOOK'].includes(d.docTypeCode) ? symbol.color : '#fff')   

        /// book chapters
        symbolGroup.filter(d => d.docTypeCode == 'COUV')
            .append('rect')
            .attr('width', chart.symbolSize * .75)
            .attr('height', chart.symbolSize)
            .attr('fill', symbol.color)
            .style('stroke', symbol.stroke)

        // journals
        symbolGroup.filter(d => docTypes.journal.includes(d.docTypeCode))
            .selectAll('rect')
            .attr('height', chart.symbolSize * 1.5)
            .attr('fill', symbol.color)

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
            .attr('fill', symbol.color)
            .attr('y', chart.symbolSize * .65)
            .attr('x', chart.symbolSize * .05)
        
        symbolGroup.filter(d => docTypes.gray.includes(d.docTypeCode))
            .append('circle')
            .attr('r', chart.symbolSize/2)
            .attr('fill', '#fff')
            .style('stroke', symbol.stroke)
            .classed('symbol', true)

        symbolGroup.on('mouseenter', d => {
            if (controls.freeze_links) return;

            // highlight documents within line of co-authors
            symbolGroup.selectAll('.symbol')
                .filter(e => e.docURI === d.docURI)
                .style('stroke', '#000')
                .style('stroke-width', 2)

            /// highlight countries of co-authors
            let countries = []
            docs.filter(e => e.docURI === d.docURI).forEach(e => {
                countries = countries.concat(e.country)
            })

            let countriesCodes = countryCodes.map(e => {
                if (countries.includes(e.country))
                    return e.alpha3
            })

            let k = d3.zoomTransform(d3.select('g.countries').selectAll('path').node()).k
            svg.select('g#map-group').selectAll('path')
                .style('stroke-width', d => countriesCodes.includes(d.properties.alpha3) ? 1.2 / k : .3)
                .style('stroke', d => countriesCodes.includes(d.properties.alpha3) ? '#000' : '#ccc')

        }).on('mouseleave', d => {
            if (controls.freeze_links) return
            svg.select('g#map-group').selectAll('path').style('stroke-width', '.3').style('stroke', '#ccc')
            symbolGroup.selectAll('.symbol').style('stroke', symbol.stroke).style('stroke-width', 1)
        })
        
        /// place circles close to each other using force simulation //////////////
        d3.forceSimulation()
            .force("x", d3.forceX().strength(0.4).x(d => xScale(d.year)))
            .force("y", d3.forceY().strength(0.2).y(d => yScale(d.author) - chart.symbolSize / 2))
            .force("collide", d3.forceCollide().strength(.1).radius(chart.symbolSize).iterations(32)) // Force that avoids circle overlapping
            .nodes(docs)
            .on("tick", () => symbolGroup.attr('transform', e => `translate(${xScale.bandwidth()/2 + e.x}, ${e.y})`))
        

        symbolGroup.append('title')
            .text(d => `${d.country.join(', ')}
                Author of Reference: ${d.author}
                Affiliation(s): ${d.labName.join('\n\t\t\t')}\n
                Title: ${d.docTitle}
                Publication Year: ${d.year}
                Document Type: ${d.docType}\n
                Bibliographic Citation: ${d.citation.split('&')[0]}\n
                Click to go to source`)
        

        function createMap (_this) {           
            
            // color code: count of publications per country
            let values = countryCodes.map(d => d.value);
            let breaks = jenks(values, values.length >= 5 ? 5 : values.length)
            const countryColor = d3.scaleThreshold()
                .domain(breaks)
                .range(['#f0f9e8','#bae4bc','#7bccc4','#43a2ca','#0868ac'])
    
            const chart = {width: _this.node.parentNode.clientWidth, height: _this.node.parentNode.clientHeight},
                margin = {top: 30, left: 0, right: 0, bottom: 0};
    
            const zoom = d3.zoom()
                .scaleExtent([1, 8])
                .on('zoom', function(){
                    gCountries.selectAll('path') 
                        .attr('transform', d3.event.transform);
                });
            
            const svg = d3.select(_this.node)
                .attr('width', chart.width)
                .attr('height', chart.height)
    
            // svg.select('g#map-group').remove()
    
            const mapGroup = svg.append('g')
                .attr('id', 'map-group')
                .attr('transform', `translate(${margin.left}, ${margin.top})`); 
                
            ///// world map ////////////
            const projection = geoRobinson()
                .scale(250)
                .rotate([352, 0, 0])
                .translate([chart.width/2, chart.height/2]);
    
            const path = d3.geoPath().projection(projection);
    
            const gCountries = mapGroup.append('g')
                .attr('class', 'countries')
                .style('cursor', 'grab')
            
            const gCountry = gCountries.selectAll('g')
                .data(world.features)
                .enter()
                    .append('g')
            
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
    
                    d3.selectAll('g.symbol-group').filter(e => {
                            let codes = countryCodes.filter(x => e.country.includes(x.country)).map(x => x.alpha3)
                            return codes.includes(d.properties.alpha3)
                        })
                        .selectAll('.symbol')
                        .style('stroke-width', 2)
                        .style('stroke', '#000')
                })
                .on('mouseout', () => {
                    if (controls.freeze_links) return;

                    d3.selectAll('.symbol').style('stroke-width', 1).style('stroke', "#666666")
                })
                // .call(zoom)
    
            gCountry.append('title')
                .text(d => d.properties.ADMIN)
    
            //// zoom & pan controls ////////
            d3.selectAll('button.zoom-control')
                .style('display', 'block')
                .style('left', d => chart.width - 30 - d.col * 35 + 'px')
                .style('top', d => 120 + d.row * 20 + 'px')
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
    
                            if (d.value === 'up') y = value
                            else if (d.value === 'down') y = -value
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
        })
    }

    render() {
        return <svg 
            ref={node => this.node = node} >
        </svg>
    }

} export default Timeline;