import { useState, useEffect } from "react";
import { Select, Typography, Row, Col, Button, Spin, Modal } from "antd";

import { fetchFromBackendGet, fetchFromBackendPost } from "./fetchFromBackend";

const { Title } = Typography;
const REACT_APP_API_URL = "http://localhost:5000";

export const BuildSankey = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [filters, setFilters] = useState({});
    const [selectedAuthors, setSelectedAuthors] = useState([]);
    const [selectedCountries, setSelectedCountries] = useState([]);
    const [selectedYears, setSelectedYears] = useState([]);

    useEffect(async () => {
        setIsLoading(true);

        const filters = await fetchFromBackendGet("filters");
        setFilters(filters);

        setIsLoading(false);
    }, []);

    const handleClick = async () => {
        if (!isDrawing) {
            if (selectedAuthors.length) {
                setIsDrawing(true);
                const res = await fetchFromBackendPost("sankey", {
                    authors: selectedAuthors,
                    countries: selectedCountries,
                    years: selectedYears,
                });

                window.open(
                    `${REACT_APP_API_URL}/sankey?_=` +
                        Math.floor(Math.random() * 99999999999999),
                    "_blank",
                    "width=4000,height=400"
                );

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
                </Row>
            </Spin>
        </>
    );
};
