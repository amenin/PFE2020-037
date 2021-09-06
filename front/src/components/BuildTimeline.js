import React, { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

import { Select, Typography, Row, Col, Button, Spin, Modal, Form } from "antd";

import { fetchFromBackendGet, fetchFromBackendPost } from "./fetchFromBackend";
import Timeline from "./Timeline";
import { filter } from "d3";

const { Title } = Typography;
const REACT_APP_API_URL = "http://localhost:5000";

export const BuildTimeline = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [filters, setFilters] = useState({});
    const [data, setData] = useState({});
    const [chartData, setChartData] = useState({})
    const [selectedAuthors, setSelectedAuthors] = useState(null);
    const [selectedCoAuthors, setSelectedCoAuthors] = useState([]);
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);
    const [coauthorsList, setCoauthorsList] = useState([]);

    const [form] = Form.useForm()

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);

            const filters = await fetchFromBackendGet("filters");
            setFilters(filters);

            setIsLoading(false);
        }
        fetchData()
    }, []);

    useEffect(() => {
        // form.resetFields()
        form.setFieldsValue({ author: selectedAuthors, coauthor: selectedCoAuthors });
    })

    const handleClick = async () => {
        if (!isDrawing) {
            if (selectedAuthors.length) {
                setIsDrawing(true);

                let authorsList = [selectedAuthors]
                selectedCoAuthors.forEach(a => authorsList.push(a))
                const res = await fetchFromBackendPost("transformedData", {
                    authors: authorsList,
                    years: filters.years,
                });
                setChartData(res)

                setIsDrawing(false);
            } else {
                Modal.error({ title: "Please select at least one author !" });
            }
        }
    };

    const retrieveData = async (value) => {
        if (!isDrawing) {
            setIsDrawing(true)

            const res = await fetchFromBackendPost("save_author_data", {
                uri: value.uri,
                author: value.name
            });

            let new_filters = null,
                new_data = {}
            if (res.message === 'done') {
                await fetchFromBackendGet("group_data")

                new_filters = await fetchFromBackendGet("filters");
                setFilters(new_filters);

                new_data = await fetchFromBackendPost("transformedData", {
                    authors: [value.name],
                    years: filters.years,
                });
            }

            setSelectedAuthors(value.name)
            setSelectedCoAuthors([])

            setChartData(new_data)

            let coauthors = []
            if (new_filters)
                coauthors = new_filters.authors?.filter(author => author.name == value.name)[0].coauthors
            else 
                coauthors = filters.authors?.filter(author => author.name == value.name)[0].coauthors
            coauthors = coauthors.filter((d,i) => i === coauthors.findIndex(e => e.name == d.name))
            coauthors.sort((a,b) => a.name.localeCompare(b.name))
            setCoauthorsList(coauthors)

            setIsDrawing(false)
        }
    };

    return (
        <>
            <Spin spinning={isDrawing} tip="Loading...">
                <Form form={form} layout="inline">
                    <Form.Item label="Select an author" name="author">
                        <Select
                            style={{ width: "200px" }}
                            placeholder="Please select"
                            allowClear="true"
                            onChange={(value) => {
                                setSelectedAuthors(value);
                                let coauthors = []
                                if (value) {
                                    coauthors = filters.authors?.filter(author => author.name == value)[0].coauthors
                                    coauthors = coauthors.filter((d,i) => i === coauthors.findIndex(e => e.name == d.name))
                                    coauthors.sort((a,b) => a.name.localeCompare(b.name))
                                } 
                                setCoauthorsList(coauthors)
                            }}
                            options={filters.authors?.map((item) => {
                                return { label: item.name, value: item.name };
                            })}
                        />
                    </Form.Item>
                    <Form.Item name="coauthor" label="Select one or more coauthors" size="middle"
                        rules={[{type: 'array' }]}>
                        <Select
                            mode="multiple"
                            style={{ width: "200px" }}
                            placeholder="Please select"
                            allowClear="true"
                            onChange={(value) => {
                                setSelectedCoAuthors(value);
                            }}
                            options={coauthorsList.map(item => { return {label: item.name, value: item.name}; })}
                        />
                    </Form.Item>       
                        {/* <Spin
                            spinning={isDrawing}
                            tip="Loading..."
                        > */}
                            <Button type="primary" onClick={handleClick}>
                                Build
                            </Button>
                        {/* </Spin> */}
                    </Form>
                <div style={
                    {width: '100%', height: window.innerHeight}}>
                    <Timeline data={chartData} retrieveData={retrieveData}></Timeline>
                </div>
            </Spin>
        </>
    );
};
