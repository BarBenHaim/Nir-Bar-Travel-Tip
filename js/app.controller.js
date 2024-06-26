import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

// To make things easier in this project structure
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onChangeTheme,
}

function onInit() {
    getFilterByFromQueryParams()
    loadAndRenderLocs()
    mapService
        .initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

// only loc service

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs
        .map(loc => {
            const className = loc.id === selectedLocId ? 'active' : ''
            return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${loc.createdAt !== loc.updatedAt ? ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}` : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`
        })
        .join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()
    renderLocStatsByDate()
    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

// only loc service

function onRemoveLoc(locId) {
    const userConfirmed = confirm('Are you sure?')
    if (userConfirmed) {
        locService
            .remove(locId)
            .then(() => {
                flashMsg('Location removed')
                unDisplayLoc()
                loadAndRenderLocs()
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot remove location')
            })
    }
}

// only map service
function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService
        .lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

// only loc service
function onAddLoc(geo) {
    const modal = showModal('Add Location', 'Add')
    const nameInput = modal.querySelector('.new-loc-name')
    const rateInput = modal.querySelector('.new-loc-rate')

    nameInput.value = ''
    rateInput.value = ''

    modal.dataset.geo = JSON.stringify(geo)
    const form = modal.querySelector('form')
    form.onsubmit = function (event) {
        event.preventDefault()

        const locName = nameInput.value
        const locRate = +rateInput.value
        const geoData = JSON.parse(modal.dataset.geo)

        if (!locName || !locRate) {
            modal.close()
            return
        }

        const loc = {
            name: locName,
            rate: locRate,
            geo: geoData,
        }

        locService
            .save(loc)
            .then(savedLoc => {
                flashMsg(`Added Location (id: ${savedLoc.id})`)
                utilService.updateQueryParams({ locId: savedLoc.id })
                loadAndRenderLocs()
                modal.close()
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot add location')
            })
    }
}

// only loc service

function loadAndRenderLocs() {
    locService
        .query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

// only map service
function onPanToUserPos() {
    mapService
        .getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

// only loc service

function onUpdateLoc(locId) {
    locService.getById(locId).then(loc => {
        const modal = showModal('Update Location', 'Update')
        const nameInput = modal.querySelector('.new-loc-name')
        const rateInput = modal.querySelector('.new-loc-rate')

        nameInput.value = loc.name
        rateInput.value = loc.rate

        const form = modal.querySelector('form')
        form.onsubmit = function (event) {
            event.preventDefault()

            const newRate = rateInput.value
            const newName = nameInput.value

            if (newRate !== loc.rate || newName !== loc.name) {
                loc.rate = newRate
                loc.name = newName

                locService
                    .save(loc)
                    .then(savedLoc => {
                        flashMsg(`Rate was set to: ${savedLoc.rate}`)
                        loadAndRenderLocs()
                        modal.close()
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot update location')
                    })
            } else {
                modal.close()
            }
        }
    })
}

// only loc service
function onSelectLoc(locId) {
    return locService
        .getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

//both
function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

//only map service
function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}
//////
function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}
////
function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url,
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({ txt, minRate })

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

// use loc service
function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

// use loc service
function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = isDesc ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

// use loc service
function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

// use loc service
function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
}

function renderLocStatsByDate() {
    locService.getLocCountByLastUpdated().then(stats => {
        console.log(stats)
        handleStats(stats, 'loc-stats-date')
    })
}

///////
function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels
        .map((label, idx) => {
            return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
        })
        .join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function showModal(title, actionButtonText) {
    const modal = document.querySelector('.update-loc-modal')
    modal.querySelector('.modal-title').innerText = title
    modal.querySelector('.modal-action-button').innerText = actionButtonText
    modal.showModal()

    const closeButton = modal.querySelector('.btn-close-modal')
    closeButton.onclick = function () {
        modal.close()
    }

    return modal
}
function onChangeTheme(val) {
    console.log(val)
    switch (val) {
        case 'dark':
            changeToDark()
            break
        case 'green':
            changeToGreen()
            break
    }
}

function changeToDark() {
    console.log('hi')

    const elHeader = document.querySelector('header')
    const elLocShow = document.querySelector('.selected-loc.show')
    const elLocContanir = document.querySelector('.locs-container')
    elHeader.style.backgroundColor = 'gray'
    elLocShow.style.backgroundColor = 'darkgray'
    elLocContanir.style.backgroundColor = 'darkgray'
}

function changeToGreen() {
    console.log('hi')

    const elHeader = document.querySelector('header')
    const elLocShow = document.querySelector('.selected-loc.show')
    const elLocContanir = document.querySelector('.locs-container')
    elHeader.style.backgroundColor = 'green'
    elLocShow.style.backgroundColor = 'lightgreen'
    elLocContanir.style.backgroundColor = 'lightgreen'
}
