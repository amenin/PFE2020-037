import React, { Component } from 'react'

import '../style/sankeyChart.css'
import '../style/flag-icon-css/css/flag-icon.min.css'
import * as d3 from 'd3'

class SankeyChart extends Component {
    constructor (props) {
        super(props)

        this.state = {
            country_codes: []
        };

        this.createSankeyChart = this.createSankeyChart.bind(this)
    }

    componentDidMount() {
        d3.json('/data/countries_fr.json')
        .then(data => {
            this.setState({country_codes: data});
            this.setImagePatterns()
            this.createSankeyChart()
        })
        .catch(function(error) { throw(error); })
        
    }   
    
    componentDidUpdate() {
        this.createSankeyChart()
    }

    setImagePatterns(){
        let countryCodes = this.state.country_codes;

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

    createSankeyChart () {

        if (!Object.keys(this.props.data).length) return;
        const svg = d3.select(this.node),
            graph = this.props.data,
            countryCodes = this.state.country_codes,
            nodeStyle = this.props.nodeStyle;
        

        svg.select('g#sankey-group').remove()
        
        // set the dimensions and margins of the graph
        const margin = { top: 30, right: 10, bottom: 100, left: 30 },
            width = this.node.parentNode.clientWidth - margin.left - margin.right,
            height = this.node.parentNode.clientHeight - margin.top - margin.bottom,
            chart = {width: width * .95, height: height * .6, nodeWidth: 50, padding: 40}

        svg.attr('width', width)
            .attr('height', height)

        const sankeyGroup = svg.append('g')
            .attr('id', 'sankey-group')
            .attr('transform', `translate(${margin.left}, ${margin.top})`)

        // format variables
        const formatNumber = d3.format(",.0f"), // zero decimal places
            valueToText = function (d) {
                return formatNumber(d) + " Publications";
            };

        // append the svg object to the body of the page
        
        // Set the sankey diagram properties
        const sankey = window.d3.sankey()
            .nodePadding(chart.padding)

        const path = sankey.link().curvature(0.2);
       
        setSankey()

        /////////////////////
        // draw x axis + info lines    
        let values = graph.nodes.map(d => { return {"date": d.year, "x": d.x}})
        values = values.filter((d,i) => i === values.findIndex(e => e.date === d.date && e.x === d.x))
        values.sort((a, b) => a.x - b.x)
        
        const axisGroup = sankeyGroup.append('g')

        const axisPos = chart.height + 20;
        axisGroup.selectAll('line')
            .data(values)
            .enter()
                .append('line')
                .attr('y1', axisPos)
                .attr('x1', d => d.x + chart.nodeWidth * .5)
                .attr('y2', 0)
                .attr('x2', d => d.x + chart.nodeWidth * .5)
                .style('stroke-width', 1)
                .style('stroke', '#ccc')
                .style('stroke-dasharray', 3)

        axisGroup.selectAll('text')
            .data(values)
            .enter()
                .append('text')
                .attr('x', d => d.x - chart.nodeWidth * .5)
                .attr('y', axisPos + 15)
                .text(d => d.date)

        axisGroup.append('line')
            .attr('x1', 0)
            .attr('y1', axisPos)
            .attr('x2', chart.width)
            .attr('y2', axisPos)
            .style('stroke-width', 2)
            .style('stroke', '#000')

        axisGroup.append('text')
            .attr('transform', `translate(${chart.width/2}, ${chart.height + 60})`)
            .style('text-anchor', 'middle')
            .text('Publication Year')

        axisGroup.append('text')
            .attr('transform', `translate(${margin.left - 50}, ${margin.top + chart.height/2})rotate(-90)`)
            .style('text-anchor', 'middle')
            .text('Authors')

        /////////////////////////// sankey diagram /////////////////////
        
       

        drawLinks()

        // add in the nodes
        const nodesGroup = sankeyGroup.append("g")
            .selectAll(".node")
            .data(graph.nodes)
            .enter()
            .append("g")
            .attr("class", "node")
            .attr("transform", function (d) {
                return `translate(${d.x}, ${d.y})`;
            })
            .call(
                d3.drag()
                    .subject(function (d) {
                        return d;
                    })
                    .on("start", function () {
                        this.parentNode.appendChild(this);
                    })
                    .on("drag", dragmove)
            )

        // nodesGroup.append("title")
        //     .text(function (d) {
        //         let name = d.name || d.year;
        //         return d.publications ? name + "\n" + valueToText(d.value) + '\n' +
        //             d.publications.map((item) => `- ${item.docTitle} (${item.labName})`).join("\r\n") : name;
        //     });

       
        // need to turn this into a set of rectangles, one per publication with the country flag
        const flagsGroup = nodesGroup.selectAll('g')
            .data(d => {
                let data = d.publications ? d.publications.map(e => { 
                    return {
                        'country': e.country,
                        'dy': d.dy / d.publications.length,
                        'x': d.dx - chart.nodeWidth,
                        'title': e.docTitle,
                        'year': e.issuedAt.split('-')[0],
                        'institution': e.labName,
                        'author': d.name
                    }
                }) : [d]
                return data
            })
            .enter()
                .append('g')

        nodesGroup.filter(d => d.name)
            .on('mouseenter', function(d) {
                d3.selectAll('path.link').style('stroke-opacity', e => e.author !== d.name ? .1 : .5)         
            })
            .on('mouseleave', function(d) {
                d3.selectAll('path.link').style('stroke-opacity', .5)         
            })

        // add in the title for the nodes
        const authorsNodes = nodesGroup.filter(d => !d.publications)
    
        authorsNodes.append("text")
            .attr('y', d => d.dy + 10)
            .attr("x", d => d.dx - chart.nodeWidth)
            .attr("text-anchor", "start")
            .attr("dy", ".35em")
            .text(d => d.name)
            .filter(d => d.x < width / 2)
        
        authorsNodes.append('title')
            .text(d => d.name)

        if (nodeStyle == 'Bars')
            drawBarNodes()
        else drawCircleNodes()
        
        ////// sankey functions ////////////
        function setSankey() {
            switch(nodeStyle) {
                case 'Bars':
                    let authors = graph.nodes.map(d => d.name)
                    authors = authors.filter((d,i) => i === authors.indexOf(d))

                    chart.nodeWidth = 20
                    let newHeight = d3.max(graph.nodes.filter(d => d.publications), d => d.publications.length) * (chart.nodeWidth * .7) + chart.padding;
                    if (authors.length == 1 && newHeight < chart.height) chart.height = newHeight;

                    break;
                case 'Circle':
                    // graph.nodes.forEach(d => d.value = 1)
                    chart.nodeHeight = chart.nodeWidth * 1.3;
                    break;
            }

            sankey.size([chart.width, chart.height])
                .nodeWidth(chart.nodeWidth)
                .links(graph.links)
                .nodes(graph.nodes)
                .layout(1)
        }

        function drawLinks() {
            // add in the links
            sankeyGroup.append("g")
                .selectAll(".link")
                .data(graph.links)
                .enter()
                .append("path")
                // .style('stroke', d => color(d.author))
                .style('stroke', '#ccc')
                .attr("class", "link")
                .attr("d", path)
                // .style("stroke-width", d => Math.max(1, d.dy))
                .style('stroke-width', 10)
                .sort(function (a, b) {
                    return b.dy - a.dy;
                })
                .on('mouseenter', function(d) {
                    d3.selectAll('path.link').style('stroke-opacity', e => e.author !== d.author ? .1 : .5)         
                })
                .on('mouseleave', function(d) {
                    d3.selectAll('path.link').style('stroke-opacity', .5)         
                })
        }

        function drawBarNodes() {
            flagsGroup.append('rect')
                .attr('y', (d,i) => i * d.dy)
                .attr('width', 20)
                .attr('height', 16)
                .style("stroke", "#000")
                .attr('fill', d => {
                    let code = countryCodes.filter(e => e.name === d.country);
                    code = code.length ? code[0].alpha2 : null;
                    return code ? `url(#flag_${code})` : '#fff';
                })
            
            flagsGroup.append('title')
                .text(d => `${d.country}\n${d.author}\n\nPublication: ${d.title} (${d.year})\nAffiliation: ${d.institution}`)
        }

        function drawCircleNodes() {
            const nodeForm = function(d){
                let w = chart.nodeWidth,
                    c = w * .2,
                    h = chart.nodeHeight;
                let path =  `
                    M${w - c},${0}
                    L${w - c},${c}
                    L${w},${c}
                    L${w - c},${0}
                    L${0},${0}
                    L${0},${d.dy}
                    L${w},${d.dy}
                    L${w},${c}
                `
                return path
            }   

            nodesGroup.filter(d => !d.publications)
                .append('circle')
                .attr('r', chart.nodeWidth/2)
                .attr('cx', chart.nodeWidth/2)
                .attr('cy', d => d.dy/2)
                .style("fill", '#fff')
                .style("stroke", "#000")

            nodesGroup.filter(d => d.publications)
                .append('path')
                .attr('d', nodeForm)
                .style("fill", '#fff')
                .style("stroke", "#000")

            const pPerRow = 3,
                pRadius = chart.nodeWidth / (pPerRow * 2); 
            flagsGroup.raise()
            flagsGroup.filter(d => !d.name)
                .append('circle')
                .attr('r', pRadius)
                .attr('cx', (_,i) => pRadius + (pRadius * 2) * (i - Math.floor(i/pPerRow) * pPerRow))
                .attr('cy', (d,i) => d.dy - pRadius - (pRadius * 2) * Math.floor(i/pPerRow))
                .style('fill', 'red')

        }
       

        // the function for moving the nodes
        function dragmove(d) {
            d3.select(this).attr(
                "transform",
                "translate(" +
                    d.x +
                    "," +
                    (d.y = Math.max(
                        0,
                        Math.min(height - d.dy, d3.event.y)
                    )) +
                    ")"
            );
            sankey.relayout();
            d3.selectAll('path.link').attr("d", path);
        }
    }

    

    render() {
        return <svg 
            ref={node => this.node = node} >
        </svg>
    }
} 
export default SankeyChart;