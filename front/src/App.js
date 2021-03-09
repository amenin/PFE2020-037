import React, { useState, useEffect } from "react";
import { Switch, Route, Link, useRouteMatch } from "react-router-dom";
import { Layout, Menu } from "antd";
import {
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    DatabaseOutlined,
    PieChartOutlined,
} from "@ant-design/icons";

import { fetchFromBackendGet } from "./components/fetchFromBackend";

import "antd/dist/antd.css";
import "./App.css";

// import { Authors } from "./components/Authors.js";
import { AuthorsData } from "./components/AuthorsData.js";
import { BuildSankey } from "./components/BuildSankey.js";
// import { Sidenav } from "./components/Sidenav.js";

const { Header, Sider, Content } = Layout;

function App() {
    const [collapsed, setCollapsed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState([]);
    const isSankey = useRouteMatch("/sankey");

    useEffect(async () => {
        setIsLoading(true);

        const response = await fetchFromBackendGet("data");
        setData(
            response.length
                ? response.map((row, index) => ({ ...row, key: index + 1 }))
                : []
        );

        setIsLoading(false);
    }, []);

    const toggle = () => {
        setCollapsed((prev) => !prev);
    };

    const handleRegenerate = async () => {
        setIsLoading(true);

        const save_data = await fetchFromBackendGet("save_data");
        const group_data = await fetchFromBackendGet("group_data");

        const response = await fetchFromBackendGet("data");
        setData(
            response.length
                ? response.map((row, index) => ({ ...row, key: index + 1 }))
                : []
        );

        setIsLoading(false);
    };

    return (
        <Layout>
            <Sider trigger={null} collapsible collapsed={collapsed}>
                <div className="logo" />
                <Menu
                    theme="dark"
                    mode="inline"
                    defaultSelectedKeys={[isSankey ? "2" : "1"]}
                >
                    <Menu.Item key="1" icon={<DatabaseOutlined />}>
                        <Link to="/">Data</Link>
                    </Menu.Item>
                    <Menu.Item key="2" icon={<PieChartOutlined />}>
                        <Link to="/sankey">Sankey diagram</Link>
                    </Menu.Item>
                </Menu>
            </Sider>
            <Layout className="site-layout">
                <Header
                    className="site-layout-background"
                    style={{ padding: 0 }}
                >
                    <Header
                        className="site-layout-background"
                        style={{ padding: 0 }}
                    >
                        {React.createElement(
                            collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
                            {
                                className: "trigger",
                                onClick: toggle,
                            }
                        )}
                    </Header>
                </Header>
                <Content
                    style={{
                        margin: "24px 50px",
                        padding: 24,
                        minHeight: 280,
                        background: "#fff",
                    }}
                >
                    <Switch>
                        <Route exact path="/">
                            <AuthorsData
                                isLoading={isLoading}
                                data={data}
                                handleRegenerate={handleRegenerate}
                            />
                        </Route>
                        <Route path="/sankey">
                            <BuildSankey data={data} />
                        </Route>
                    </Switch>
                </Content>
            </Layout>
        </Layout>
    );
}

export default App;
