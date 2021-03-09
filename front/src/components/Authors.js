import { useEffect, useState } from "react";
import { Table, Button, Spin } from "antd";
import { ReloadOutlined } from "@ant-design/icons";

import { fetchFromBackendGet } from "./fetchFromBackend";

export const Authors = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [data, setData] = useState([]);

    useEffect(async () => {
        setIsLoading(true);

        const response = await fetchFromBackendGet("authors");
        setData(
            response.length
                ? response.map((row, index) => ({ ...row, key: index + 1 }))
                : []
        );

        setIsLoading(false);
    }, []);

    const handleClick = () => {
        if (!isLoading) {
            setIsLoading(true);
            console.log("PATCH(authors)");
        }
    };

    if (error) {
        return <div>Error</div>;
    }

    return (
        <>
            {false && (
                <center style={{ marginBottom: "10px" }}>
                    <Button
                        type="primary"
                        icon={<ReloadOutlined />}
                        onClick={handleClick}
                    >
                        Charger les auteurs
                    </Button>
                </center>
            )}

            <Spin spinning={isLoading} tip="Loading...">
                <Table
                    dataSource={data}
                    columns={[
                        {
                            title: "Author ID",
                            dataIndex: "authorId",
                            key: "authorId",
                            render: (text) =>
                                text.replaceAll(
                                    "https://data.archives-ouvertes.fr/author/",
                                    ""
                                ),
                        },
                        {
                            title: "# countries",
                            dataIndex: "count",
                            key: "count",
                        },
                    ]}
                />
            </Spin>
        </>
    );
};
