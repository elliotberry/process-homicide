import {search} from "fast-fuzzy";


const fuzzySearch = (query, data) => search(query, data, {keySelector: ({name}) => name})

export default fuzzySearch;