import { Table, Typography, Spin, Button, Modal } from "antd";
import { DownloadOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
const { confirm } = Modal;

const { Title } = Typography;

export const AuthorsData = ({ isLoading, data, handleRegenerate }) => {
    const handleClick = () => {
        showConfirm();
    };

    const showConfirm = () => {
        confirm({
            title:
                "You're going to extract data related to 100 authors from HAL's RDF Database",
            content: "This can take a few minutes",
            icon: <ExclamationCircleOutlined />,
            onOk() {
                handleRegenerate();
            },
            onCancel() {},
        });
    };

    return (
        <Spin spinning={isLoading} tip="Loading...">
            <Title level={3}>Data from data.archives-ouvertes.fr</Title>
            {data.length ? (
                <Title level={5}>
                    100 authors who have passed through at least 2 countries
                </Title>
            ) : null}
            <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleClick}
            >
                {data.length ? "Regenerate" : "Generate"}
            </Button>
            <Table
                style={{ marginTop: 10 }}
                dataSource={data}
                pagination={{ position: ["topRight"] }}
                columns={[
                    {
                        title: "Author",
                        dataIndex: "authorName",
                        key: "authorName",
                        filters: data
                            .map((item) => item["authorName"])
                            .filter((x, i, a) => a.indexOf(x) == i)
                            .map((item) => {
                                return {
                                    text: item,
                                    value: item,
                                };
                            }),
                        onFilter: (value, record) =>
                            record.authorName.indexOf(value) === 0,
                    },
                    {
                        title: "Document",
                        dataIndex: "docTitle",
                        key: "docTitle",
                    },
                    {
                        title: "issuedAt",
                        dataIndex: "issuedAt",
                        key: "issuedAt",
                    },
                    {
                        title: "availableAt",
                        dataIndex: "availableAt",
                        key: "availableAt",
                    },
                    {
                        title: "Structure",
                        dataIndex: "labName",
                        key: "labName",
                    },
                    {
                        title: "Country",
                        dataIndex: "country",
                        key: "country",
                    },
                    {
                        title: "Adress",
                        dataIndex: "adress",
                        key: "adress",
                    },
                ]}
                scroll={{ x: 2000 }}
                sticky
            />
        </Spin>
    );
};
