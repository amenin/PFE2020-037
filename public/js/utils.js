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
    // text.each(function() {
        // var text = d3.select(this),
        text.selectAll('tspan').remove()

        let words = text.text().split(' ').reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            y = text.attr("y"),
            x = text.attr('x'),
            dy = parseFloat(text.attr("dy")),
            tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");

        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    // });
}

function wrap_ellipsis(self, width) {
    let textLength = self.node().getComputedTextLength(),
        text = self.text();

    while (textLength > (width - 3) && text.length > 0) {
        text = text.slice(0, -1);
        self.text(text + '...');
        textLength = self.node().getComputedTextLength();
    }
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


/***** ALL MATH FUNCTIONS ****/

var to_radians = Math.PI / 180;
var to_degrees = 180 / Math.PI;


// Helper function: cross product of two vectors v0&v1
function cross(v0, v1) {
    return [v0[1] * v1[2] - v0[2] * v1[1], v0[2] * v1[0] - v0[0] * v1[2], v0[0] * v1[1] - v0[1] * v1[0]];
}

//Helper function: dot product of two vectors v0&v1
function dot(v0, v1) {
    for (var i = 0, sum = 0; v0.length > i; ++i) sum += v0[i] * v1[i];
    return sum;
}

// Helper function: 
// This function converts a [lon, lat] coordinates into a [x,y,z] coordinate 
// the [x, y, z] is Cartesian, with origin at lon/lat (0,0) center of the earth
function lonlat2xyz( coord ){

	var lon = coord[0] * to_radians;
	var lat = coord[1] * to_radians;

	var x = Math.cos(lat) * Math.cos(lon);

	var y = Math.cos(lat) * Math.sin(lon);

	var z = Math.sin(lat);

	return [x, y, z];
}

// Helper function: 
// This function computes a quaternion representation for the rotation between to vectors
// https://en.wikipedia.org/wiki/Rotation_formalisms_in_three_dimensions#Euler_angles_.E2.86.94_Quaternion
function quaternion(v0, v1) {

	if (v0 && v1) {
		
	    var w = cross(v0, v1),  // vector pendicular to v0 & v1
	        w_len = Math.sqrt(dot(w, w)); // length of w     

        if (w_len == 0)
        	return;

        var theta = .5 * Math.acos(Math.max(-1, Math.min(1, dot(v0, v1)))),

	        qi  = w[2] * Math.sin(theta) / w_len; 
	        qj  = - w[1] * Math.sin(theta) / w_len; 
	        qk  = w[0]* Math.sin(theta) / w_len;
	        qr  = Math.cos(theta);

	    return theta && [qr, qi, qj, qk];
	}
}

// Helper function: 
// This functions converts euler angles to quaternion
// https://en.wikipedia.org/wiki/Rotation_formalisms_in_three_dimensions#Euler_angles_.E2.86.94_Quaternion
function euler2quat(e) {

	if(!e) return;
    
    var roll = .5 * e[0] * to_radians,
        pitch = .5 * e[1] * to_radians,
        yaw = .5 * e[2] * to_radians,

        sr = Math.sin(roll),
        cr = Math.cos(roll),
        sp = Math.sin(pitch),
        cp = Math.cos(pitch),
        sy = Math.sin(yaw),
        cy = Math.cos(yaw),

        qi = sr*cp*cy - cr*sp*sy,
        qj = cr*sp*cy + sr*cp*sy,
        qk = cr*cp*sy - sr*sp*cy,
        qr = cr*cp*cy + sr*sp*sy;

    return [qr, qi, qj, qk];
}

// This functions computes a quaternion multiply
// Geometrically, it means combining two quant rotations
// http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/arithmetic/index.htm
function quatMultiply(q1, q2) {
	if(!q1 || !q2) return;

    var a = q1[0],
        b = q1[1],
        c = q1[2],
        d = q1[3],
        e = q2[0],
        f = q2[1],
        g = q2[2],
        h = q2[3];

    return [
     a*e - b*f - c*g - d*h,
     b*e + a*f + c*h - d*g,
     a*g - b*h + c*e + d*f,
     a*h + b*g - c*f + d*e];

}

// This function computes quaternion to euler angles
// https://en.wikipedia.org/wiki/Rotation_formalisms_in_three_dimensions#Euler_angles_.E2.86.94_Quaternion
function quat2euler(t){

	if(!t) return;

	return [ Math.atan2(2 * (t[0] * t[1] + t[2] * t[3]), 1 - 2 * (t[1] * t[1] + t[2] * t[2])) * to_degrees, 
			 Math.asin(Math.max(-1, Math.min(1, 2 * (t[0] * t[2] - t[3] * t[1])))) * to_degrees, 
			 Math.atan2(2 * (t[0] * t[3] + t[1] * t[2]), 1 - 2 * (t[2] * t[2] + t[3] * t[3])) * to_degrees
			]
}

/*  This function computes the euler angles when given two vectors, and a rotation
	This is really the only math function called with d3 code.

	v0 - starting pos in lon/lat, commonly obtained by projection.invert
	v1 - ending pos in lon/lat, commonly obtained by projection.invert
	o0 - the projection rotation in euler angles at starting pos (v0), commonly obtained by projection.rotate
*/

function eulerAngles(v0, v1, o0) {

	/*
		The math behind this:
		- first calculate the quaternion rotation between the two vectors, v0 & v1
		- then multiply this rotation onto the original rotation at v0
		- finally convert the resulted quat angle back to euler angles for d3 to rotate
	*/

	var t = quatMultiply( euler2quat(o0), quaternion(lonlat2xyz(v0), lonlat2xyz(v1) ) );
	return quat2euler(t);	
}


/**************end of math functions**********************/