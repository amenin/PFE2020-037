import React, { useState, useEffect } from "react";
import ReactDOM from 'react-dom';

import { Select, Typography, Row, Col, Button, Spin, Modal } from "antd";

import { fetchFromBackendGet, fetchFromBackendPost } from "./fetchFromBackend";
import Timeline from "./Timeline";

const { Title } = Typography;
const REACT_APP_API_URL = "http://localhost:5000";

export const BuildTimeline = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [filters, setFilters] = useState({});
    const [data, setData] = useState({});
    const [chartData, setChartData] = useState({})
    const [selectedAuthors, setSelectedAuthors] = useState([]);
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);

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

                setChartData(res)

                setIsDrawing(false);
            } else {
                Modal.error({ title: "Please select at least one author !" });
            }
        }
    };

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
                        <Spin
                            style={{ marginTop: 20 }}
                            spinning={isDrawing}
                            tip="Loading..."
                        >
                            <Button style={{ marginTop: 38 }}  type="primary" onClick={handleClick}>
                                Build
                            </Button>
                        </Spin>
                    </Col>
                </Row>
                <div style={
                    {width: '100%', height: window.innerHeight}}>
                    <Timeline data={chartData}></Timeline>
                </div>
            </Spin>
        </>
    );
};
