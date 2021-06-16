import React, { Component } from 'react'

import * as d3 from 'd3'
import { schemeCategory10, interpolateBlues } from 'd3-scale-chromatic'
import { geoRobinson } from 'd3-geo-projection'
import { jenks } from 'simple-statistics'
import { stack } from 'd3'
import vanDerGrinten4 from 'd3-geo-projection/src/vanDerGrinten4'

class Timeline extends Component {
    constructor (props) {
        super(props)

        this.state = {
            country_codes: [],
            world: {},
            selected_countries: []        
        };

        this.createTimeline = this.createTimeline.bind(this)
        this.createMap = this.createMap.bind(this)
    }

    // static method
    // dont have access of 'this'
    // return object will update the state
    // static getDerivedStateFromProps(props, state) {
    //     if (!Object.keys(props.data).length) return state;

    //     let nestedData = d3.nest()
    //         .key(function(d) { return d.country; })
    //         .sortKeys((a,b) => a.localeCompare(b))
    //         .entries(props.data.publications)

    //     /// keep only information for selected countries /////
    //     let validCountries = nestedData.map(d => {
    //         let authors = d.values.map(e => e.author)
    //         authors = authors.filter((d,i) => i === authors.indexOf(d))

    //         authors = authors.map(e => {
    //             return {
    //                 'name': e,
    //                 'value': d.values.filter(v => v.author === e).length
    //             }
    //         })

    //         let res = state.country_codes.filter(item => item.name === d.key);
    //         return {
    //             'country': d.key, 
    //             'authors': authors,
    //             'value': d.values.length,
    //             'alpha3': res.length ? res[0].alpha3 : null,
    //             'alpha2': res.length ? res[0].alpha2 : null
    //         }
    //     })

    //     return {country_codes: state.country_codes, world: state.world, selected_countries: validCountries};
    // }

    shouldComponentUpdate (nextProps, nextState) {
        return Object.keys(nextProps.data).length && this.props.data !== nextProps.data
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
        })
        .catch(function(error) { throw(error); })
    }   
    
    componentDidUpdate() {
        const updateState = new Promise((resolve, reject) => {
            if (!Object.keys(this.props.data).length) return;

            let nestedData = d3.nest()
                .key(function(d) { return d.country; })
                .sortKeys((a,b) => a.localeCompare(b))
                .entries(this.props.data.publications)
    
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
            this.createMap()
            this.createTimeline()
        })
        
    }
 
    createImagePatterns(){
        let countryCodes = this.state.selected_countries;

        d3.select('g#patterns-group').remove()

        var defs = d3.select(this.node)
            .append('g')
            .attr('id', 'patterns-group')
            .selectAll('defs')
            .data(countryCodes)
            .enter()
                .append('defs')

        defs.append("pattern")
            .attr("id", d => "flag_" + d.alpha2)
            .attr("width", 20)
            .attr("height", 20)
            .attr("patternUnits", "userSpaceOnUse")
                .append("svg:image")
                .attr("xlink:href", d => `${process.env.PUBLIC_URL}/flags/${d.alpha2}.svg`)
                .attr("width", 20)
                .attr("height", 20)
                .attr("x", 0)
                .attr("y", 0);
    }

    createMap () {
        if (!Object.keys(this.props.data).length) return;

        // let data = this.props.data.publications,
        let world = this.state.world,
            countryCodes = this.state.selected_countries;
        
        // color code: count of publications per country
        let values = countryCodes.map(d => d.value);
        let breaks = jenks(values, values.length >= 5 ? 5 : values.length)
        const countryColor = d3.scaleThreshold()
            .domain(breaks)
            .range(['#f0f9e8','#bae4bc','#7bccc4','#43a2ca','#0868ac'])

        const chart = {width: this.node.parentNode.clientWidth, height: this.node.parentNode.clientHeight},
            margin = {top: 30, left: 0, right: 0, bottom: 0};

        const zoom = d3.zoom()
            .scaleExtent([1, 8])
            .on('zoom', function(){
                gCountries.selectAll('path') 
                    .attr('transform', d3.event.transform);
            });
        
        const svg = d3.select(this.node)
            .attr('width', chart.width)
            .attr('height', chart.height)

        svg.select('g#map-group').remove()

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
            .call(zoom)
        
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

        gCountry.append('title')
            .text(d => d.properties.ADMIN)

        //// zoom & pan controls ////////
        
        const buttons = [{'icon': '+', 'row': 0, 'col': 3, 'value': 'plus', 'action': 'zoom'},
            {'icon': '-', 'row': 0, 'col': 4, 'value': 'minus', 'action': 'zoom'},
            {'icon': '>', 'row': 1, 'col': 0, 'value': 'right', 'action': 'pan'},
            {'icon': '<', 'row': 1, 'col': 1.5, 'value': 'left', 'action': 'pan'},
            {'icon': '>', 'row': 0, 'col': 0, 'value': 'up', 'action': 'pan'},
            {'icon': '<', 'row': 2, 'col': 0, 'value': 'down', 'action': 'pan'}]
        
        const gControls = mapGroup.append('g')
            .classed('controls', true)

        const button = gControls.selectAll('g')
            .data(buttons)
            .enter()
                .append('g')
                .attr('transform', (d,i) => `translate(${chart.width - 30 - d.col * 30}, ${margin.top + d.row * 23})`)
                .style('cursor', 'pointer')
                .style('fill', '#000')
                .on('click', d => {
                    let value = 20;
                    switch(d.action) {
                        case 'zoom':
                            value = d.value === 'plus' ? 1.3 : 1 / 1.3;
                            zoom.scaleBy(gCountries.selectAll('path').transition().duration(750), value)
                            break;
                        case 'pan':
                            let x = 0, y = 0;

                            if (d.value === 'up') y = value
                            else if (d.value === 'down') y = -value
                            else if (d.value === 'left') x = -value
                            else x = value
                            zoom.translateBy(gCountries.selectAll('path').transition().duration(750), x, y)
                            break;
                    }
                    
                })
        
        button.append('text')
            .style('font-size', '35px')
            .attr('transform', d => `rotate(${['up', 'down'].includes(d.value) ? -90 : 0})`)
            .text(d => d.icon)       

    }

    createTimeline () {
        if (!Object.keys(this.props.data).length) return;
        
        let data = this.props.data.publications,
            countryCodes = this.state.selected_countries;
        
        let nestedData = d3.nest()
            .key(function(d) { return d.author; })
            .sortKeys((a,b) => a.localeCompare(b))
            .entries(data)

        const authors = nestedData.map(d => d.key)
        
        const margin = { top: 100, right: 0, bottom: 100, left: 50 },
            width = this.node.parentNode.clientWidth - margin.left - margin.right,
            chart = { width: width * .95, height: 150 * authors.length, symbolSize: 60 };

        if (chart.height > this.node.parentNode.clientHeight)
            this.node.parentNode.style.height = chart.height + 150 + 'px';
        
        const svg = d3.select(this.node)
            .attr('height', this.node.parentNode.clientHeight)
           
        svg.select('g#group-chart').remove()

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
        
        let dates = data.map(d => d.year)
        dates = dates.filter((d,i) => i === dates.indexOf(d))
        dates.sort((a,b) => +a - (+b))

        const xScale = d3.scaleBand()
            .domain(dates)
            .range([0, chart.width])
            .paddingInner(0.2);

        chart.symbolSize = xScale.bandwidth() * 2

        const xAxis = d3.axisBottom()
            .ticks(dates.length)
            .tickFormat(d => d.toString())
            .scale(xScale)

        chartGroup.append('g')
            .attr('transform', `translate(0, ${chart.height})`)
            .call(xAxis)
        
        chartGroup.append('g')
            .attr('transform', `translate(0, 0)`)
            .call(yAxis)
            .selectAll("text")	
                .style("text-anchor", "end")
                .attr("dx", "-.5em")
                .attr("dy", "-.15em")
                .attr("transform", "rotate(-65)");

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

        gridGroup.selectAll('line.vert')
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
            .range([ xScale.bandwidth()/2, -xScale.bandwidth()/2 ]);
        
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
        authorGroup.selectAll("path")
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
                    let visitedCountries = countryCodes.filter(e => e.authors.some(a => a.name === d.key))

                    svg.select('g#map-group').selectAll('path')
                        .style('stroke-width', d => visitedCountries.some(e => e.alpha3 === d.properties.alpha3) ? 1.5 : .3)
                        .style('stroke', d => visitedCountries.some(e => e.alpha3 === d.properties.alpha3) ? '#000' : '#ccc')

                }).on('mouseleave', d => {
                    svg.select('g#map-group').selectAll('path').style('stroke-width', '.3').style('stroke', '#ccc')
                })

        /// publications per country ///////////////
        let patternSize = chart.symbolSize / 12;
        let patterns = d3.selectAll('pattern')
        patterns.attr('width', patternSize).attr('height', patternSize)
        patterns.selectAll('image').attr('width', patternSize).attr('height', patternSize)

        const docTypes = ['Book', 'ConferencePaper', 'Article', 'Chapter', 'DoctoralThesis', 'Hdr', 'Other']
        const shapes = [ d3.symbolDiamond, d3.symbolCross, d3.symbolCircle, d3.symbolSquare, d3.symbolStar, d3.symbolTriangle, d3.symbolWye ]
        const symbol = d3.symbol().size(chart.symbolSize).type(d3.symbolDiamond)

        const flagsGroup = chartGroup.append('g')
        
        const symbols = flagsGroup.selectAll('path.symbol')
            .data(data)
            .enter()
                .append('path')
                .attr('d', symbol.type(d => { let index = docTypes.indexOf(d.docType)
                        return index >= 0 ? shapes[index] : shapes[6]
                    }))
                .style('stroke', '#000')
                .style('stroke-width', '.2')
                .attr('fill', d => {
                    let code = countryCodes.filter(e => e.country === d.country);
                    code = code.length ? code[0].alpha2 : null;
                    return code ? `url(#flag_${code})` : '#fff';
                })
        
        /// place circles close to each other using force simulation //////////////
        d3.forceSimulation()
            .force("x", d3.forceX().strength(0.4).x(d => xScale(+d.year)))
            .force("y", d3.forceY().strength(0.2).y(d => yScale(d.author)))
            .force("collide", d3.forceCollide().strength(.1).radius(chart.symbolSize/12).iterations(32)) // Force that avoids circle overlapping
            .nodes(data)
            .on("tick", () => symbols.attr('transform', e => `translate(${xScale.bandwidth()/2 + e.x}, ${e.y})`))
        

        symbols.append('title')
            .text(d => `${d.country}\n${d.author}\nAffiliation: ${d.labName}\n\n${d.docTitle} (${d.year})\nPublication Type: ${d.docType}`)
        
    }

    render() {
        return <svg 
            ref={node => this.node = node} >
        </svg>
    }

} export default Timeline;