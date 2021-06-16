import React, { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

import { Select, Typography, Row, Col, Button, Spin, Modal } from "antd";

import { fetchFromBackendGet, fetchFromBackendPost } from "./fetchFromBackend";
import SankeyChart from './SankeyChart';

const { Title } = Typography;
const REACT_APP_API_URL = "http://localhost:5000";

export const BuildSankey = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [filters, setFilters] = useState({});
    const [data, setData] = useState({});
    const [sankeyData, setSankeyData] = useState({})
    const [selectedAuthors, setSelectedAuthors] = useState([]);
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);
    const [selectedNodeStyle, setNodeStyle] = useState('Bars');

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);

            const filters = await fetchFromBackendGet("filters");
            setFilters(filters);
            
            setIsLoading(false);
        }
        fetchData()
    }, []);

    const handleClick = async () => {
        if (!isDrawing) {
            if (selectedAuthors.length) {
                setIsDrawing(true);
                
                const res = await fetchFromBackendPost("sankey", {
                    authors: selectedAuthors,
                    countries: filters.countries,
                    years: filters.years,
                });

                setSankeyData(res)

                setIsDrawing(false);
            } else {
                Modal.error({ title: "Please select at least one author !" });
            }
        }
    };

    const changeNodeStyle = async(value) => setNodeStyle(value)

    return (
        <>
            <Spin spinning={isLoading} tip="Loading...">
                <Title level={3}>Build sankey diagram</Title>
                <Row gutter={[24, 12]}>
                    <Col span={8}>
                        <Title level={4}>Select authors</Title>
                        <Select
                            mode="multiple"
                            style={{ width: "100%" }}
                            placeholder="Please select"
                            allowClear="true"
                            onChange={(value) => {
                                setSelectedAuthors(value);
                            }}
                            options={filters.authors?.map((item) => {
                                return { label: item.name, value: item.id };
                            })}
                        />
                    </Col>
                    <Col span={8}>
                        <Title level={4}>Select countries</Title>
                        <Select
                            mode="multiple"
                            style={{ width: "100%" }}
                            placeholder="Please select"
                            onChange={(value) => {
                                setSelectedCountries(value);
                            }}
                            options={filters.countries?.map((item) => {
                                return { value: item };
                            })}
                        />
                    </Col>
                    <Col span={8}>
                        <Title level={4}>Select years</Title>
                        <Select
                            mode="multiple"
                            style={{ width: "100%" }}
                            placeholder="Please select"
                            onChange={(value) => {
                                setSelectedYears(value);
                            }}
                            options={filters.years
                                ?.sort((a, b) => {
                                    return a - b;
                                })
                                .map((item) => {
                                    return { value: item };
                                })}
                        />
                    </Col>
                    <Col span={24}>
                        <Spin
                            style={{ marginTop: 20 }}
                            spinning={isDrawing}
                            tip="Loading..."
                        >
                            <Button type="primary" onClick={handleClick}>
                                Build
                            </Button>
                        </Spin>
                    </Col>
                    {/* <Col span={8}>
                        <Spin
                            style={{ marginTop: 20 }}
                            spinning={isDrawing}
                            tip="Loading..."
                        >
                            <Title level={4}>Node Style</Title>
                            <Select
                                style={{ width: "100%" }}
                                placeholder="Please select"
                                onChange={(value) => {
                                    changeNodeStyle(value);
                                }}
                                options={[{value: 'Bars'}, {value: 'Circle'}]}
                                // defaultValue={{value: 'Bars'}}
                            />
                            
                        </Spin>
                    </Col> */}
                </Row>
                <div style={
                    {width: '100%', height: window.innerHeight}}>
                    <SankeyChart data={sankeyData} nodeStyle={selectedNodeStyle}></SankeyChart>
                </div>
            </Spin>
        </>
    );
};
