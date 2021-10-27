const protocol = window.location.protocol +'//';
const hostname = window.location.host;

function setFilters(data) {
    let selected = arguments.length > 1 ? arguments[1] : null;
    
    data.authors = data.authors.filter(d => Object.keys(data.coauthors).includes(d.uri))
    data.authors = data.authors.filter((d,i) => data.authors.findIndex(x => x.name === d.name && x.uri === d.uri) === i)
    data.authors.sort((a,b) => a.name.localeCompare(b.name))

    d3.select('table#authors-list').selectAll('tr').remove()
    const authorsItems = d3.select('table#authors-list')        
        .selectAll('tr')
        .data(data.authors)
        .enter()
            .append('tr')
            .classed('item', true)
                
    authorsItems.append('input')
        .attr('type', 'radio')
        .property('checked', d => selected && selected.uri == d.uri ? true : false)
        .on('change', function(d) {
            let _this = this;
            d3.select(this.parentNode.parentNode)
                .selectAll('input')
                .property('checked', function() { return this === _this ? true : false })   

            d3.select('div.coauthors').style('display', 'inline-block')
            
            const selectedAuthor = d3.select(this.parentNode).datum()
            setCoauthorsList(selectedAuthor)
        })

    if (selected) setCoauthorsList(selected)

    authorsItems.append('text')                
        .text(d => d.name)

    d3.select('button.submitbtn').on('click', submitForm)

    d3.selectAll('button.dropbtn').on('click', openDropdown)

    function setCoauthorsList(selectedAuthor){
        d3.select('table#coauthors-list').selectAll('tr').remove()

        let coauthors_data = data.coauthors[selectedAuthor.uri]
        coauthors_data = coauthors_data.filter((d,i) => coauthors_data.findIndex(x => x.name === d.name && x.uri === d.uri) === i)
        coauthors_data.sort((a,b) => a.name.localeCompare(b.name))

        const coauthorItems =  d3.select('table#coauthors-list')
            .selectAll('tr')
            .data(coauthors_data)
            .enter()
                .append('tr')
                .classed('item', true)

        coauthorItems.append('input')
            .attr('type', 'checkbox')

        coauthorItems.append('text')
            .text(e => e.name)
    }
}

function submitForm(){
    showLoading("Loading visualization...")
    d3.selectAll('.dropdown-content').style('display', 'none')

    let selectedAuthor = null; 
    let selectedCoauthors = []; 

    d3.select('table#authors-list').selectAll('input').each(function(){
        if (this.checked) {
            selectedAuthor = d3.select(this.parentNode).datum()
        }
    })

    d3.select('table#coauthors-list').selectAll('input').each(function(){
        if (this.checked) {
            selectedCoauthors.push(d3.select(this.parentNode).datum())
        }
    })

    selectedCoauthors.push(selectedAuthor)

    // send request to server: retrieve documents for selected co-authors
    const url = protocol + hostname + "/get_docs"; // local server
    
    fetch(url, {
        method: 'POST',
        body: JSON.stringify({'authors': selectedCoauthors})
    }).then(response => {
        return response.text();
    }).then(res => {
        hideLoading();
        if (res.startsWith('Virtuoso')) {
            // Syntax error message
            window.alert(res);
        } else {
            timeline.update(JSON.parse(res))
        }
    }).catch(error => {
        alert(error);
    });
}

function fetchData(author){
    showLoading('Fetching data for author ' + author.name)
    const url = protocol + hostname + "/get_author_data"; // local server

    fetch(url, {
        method: 'POST',
        body: JSON.stringify({'author': {'name': author.name, 'uri': author.uri}})
    }).then(response => {
        return response.text();
    }).then(res => {
        hideLoading();
        if (res.startsWith('Virtuoso')) {
            // Syntax error message
            window.alert(res);
        } else {
            timeline.clear()
            setFilters(JSON.parse(res), author)
        }
    }).catch(error => {
        alert(error);
    });
}

/// generic interface's functions ////////
function openDropdown(){
   
    const dropdownContent = this.nextElementSibling;
    d3.select(this.parentNode.parentNode)
        .selectAll('.dropdown-content')
        .filter(function() { return this !== dropdownContent; })
        .style('display', 'none')
    
    if(dropdownContent.style.display == "block")
        dropdownContent.style.display = "none";
    else
        dropdownContent.style.display = "block"; 
}

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

function showLoading(loadingInfo) {
    const loadingElem = document.getElementById("div-loading")
    loadingElem.style.display = 'block';
    loadingElem.innerHTML = `${loadingInfo} <br><i class="fas fa-spinner fa-spin fa-2x"></i>`;
}

function hideLoading () {
    document.getElementById("div-loading").style.display = 'none';
}


function testVisualization(data) {
    let author = data.authors.filter(d => d.name === 'Enrico Formenti')[0]
    let coauthors = data.coauthors[author.uri].splice(0,10)

    coauthors = coauthors.concat(author)
    // send request to server: retrieve documents for selected co-authors
    const url = protocol + hostname + "/get_docs"; // local server
    
    fetch(url, {
        method: 'POST',
        body: JSON.stringify({'authors': coauthors})
    }).then(response => {
        return response.text();
    }).then(res => {
        hideLoading();
        if (res.startsWith('Virtuoso')) {
            // Syntax error message
            window.alert(res);
        } else {
            timeline.update(JSON.parse(res))
        }
    }).catch(error => {
        alert(error);
    });
}


function getTicksDistance(scale, breaks) {
    const spaces = []
    for(let i=0; i < breaks.length - 1; i++){
      spaces.push(Math.abs(scale(breaks[i+1]) - scale(breaks[i]) - scale.padding()))
    }
    spaces.push(spaces[spaces.length - 1])
    return spaces;
};
