import Route from 'Common/Types/API/Route';
import Page from 'CommonUI/src/Components/Page/Page';
import React, { FunctionComponent, ReactElement } from 'react';
import PageMap from '../../Utils/PageMap';
import RouteMap from '../../Utils/RouteMap';
import PageComponentProps from '../PageComponentProps';
import DashboardSideMenu from './SideMenu';
import ModelTable from 'CommonUI/src/Components/ModelTable/ModelTable';
import ApiKey from 'Model/Models/ApiKey';
import TableColumnType from 'CommonUI/src/Components/Table/Types/TableColumnType';
import FormFieldSchemaType from 'CommonUI/src/Components/Forms/Types/FormFieldSchemaType';
import { IconProp } from 'CommonUI/src/Components/Icon/Icon';

const APIKeys: FunctionComponent<PageComponentProps> = (
    props: PageComponentProps
): ReactElement => {
    return (
        <Page
            title={'Project Settings'}
            breadcrumbLinks={[
                {
                    title: 'Project',
                    to: RouteMap[PageMap.HOME] as Route,
                },
                {
                    title: 'Settings',
                    to: RouteMap[PageMap.SETTINGS] as Route,
                },
                {
                    title: 'API Keys',
                    to: RouteMap[PageMap.SETTINGS_APIKEYS] as Route,
                },
            ]}
            sideMenu={<DashboardSideMenu />}
        >
            <ModelTable<ApiKey>
                type={ApiKey}
                model={new ApiKey()}
                id="api-keys-table"
                isDeleteable={false}
                isEditable={true}
                isCreateable={true}
                isViewable={true}
                cardProps={{
                    icon: IconProp.Terminal,
                    title: 'API Keys',
                    description:
                        'All you can do on the dashboard can be done via the API. Use OneUptime API to automated repetitive work or integrate with other platforms you have.',
                }}
                noItemsMessage={'No API Keys created for this project so far.'}
                formFields={[
                    {
                        field: {
                            name: true,
                        },
                        title: 'Name',
                        fieldType: FormFieldSchemaType.Text,
                        required: true,
                        placeholder: 'API Key Name',
                        validation: {
                            noSpaces: true,
                            minLength: 2,
                        },
                    },
                    {
                        field: {
                            description: true,
                        },
                        title: 'Description',
                        fieldType: FormFieldSchemaType.LongText,
                        required: true,
                        placeholder: 'API Key Description',
                    },
                    {
                        field: {
                            expiresAt: true,
                        },
                        title: 'Expires',
                        fieldType: FormFieldSchemaType.Date,
                        required: true,
                        placeholder: 'Expires at',
                        validation: {
                            dateShouldBeInTheFuture: true,
                        },
                    },
                ]}
                showRefreshButton={true}
                showFilterButton={true}
                currentPageRoute={props.pageRoute}
                columns={[
                    {
                        field: {
                            name: true,
                        },
                        title: 'Name',
                        type: TableColumnType.Text,
                        isFilterable: true,
                    },
                    {
                        field: {
                            description: true,
                        },
                        title: 'Description',
                        type: TableColumnType.Text,
                        isFilterable: true,
                    },
                    {
                        field: {
                            expiresAt: true,
                        },
                        title: 'Expires',
                        type: TableColumnType.Date,
                        isFilterable: true,
                        options: {
                            onlyShowDate: true,
                        },
                    },
                ]}
            />
        </Page>
    );
};

export default APIKeys;
