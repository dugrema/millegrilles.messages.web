import ReactQuill from 'react-quill'

function QuillEditor(props) {
    const {value, onChange} = props
    return (
        <>
            <ReactQuill className="editeur-body" value={value} onChange={onChange} />
            <br className="clear"/>
        </>
    )
}

export default QuillEditor
