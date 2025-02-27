import BaseModel from 'Common/Models/BaseModel';
import ObjectID from 'Common/Types/ObjectID';
import Query from './Query';
import Select from './Select';
import API from '../../Utils/API/API';
import Route from 'Common/Types/API/Route';
import URL from 'Common/Types/API/URL';
import BadDataException from 'Common/Types/Exception/BadDataException';
import { DASHBOARD_API_URL } from '../../Config';
import HTTPResponse from 'Common/Types/API/HTTPResponse';
import HTTPMethod from 'Common/Types/API/HTTPMethod';
import HTTPErrorResponse from 'Common/Types/API/HTTPErrorResponse';
import { JSONArray, JSONFunctions, JSONObject } from 'Common/Types/JSON';
import { FormType } from '../../Components/Forms/ModelForm';
import Dictionary from 'Common/Types/Dictionary';
import ProjectUtil from '../Project';
import Sort from './Sort';
import Project from 'Model/Models/Project';
import Populate from './Populate';

export interface ListResult<TBaseModel extends BaseModel> {
    data: Array<TBaseModel>;
    count: number;
    skip: number;
    limit: number;
}

export default class ModelAPI {
    public static async create<TBaseModel extends BaseModel>(
        model: TBaseModel,
        apiUrlOverride?: URL
    ): Promise<
        HTTPResponse<JSONObject | JSONArray | TBaseModel | Array<TBaseModel>>
    > {
        return await ModelAPI.createOrUpdate(
            model,
            FormType.Create,
            apiUrlOverride
        );
    }

    public static async update<TBaseModel extends BaseModel>(
        model: TBaseModel,
        apiUrlOverride?: URL
    ): Promise<
        HTTPResponse<JSONObject | JSONArray | TBaseModel | Array<TBaseModel>>
    > {
        return await ModelAPI.createOrUpdate(
            model,
            FormType.Update,
            apiUrlOverride
        );
    }

    public static async createOrUpdate<TBaseModel extends BaseModel>(
        model: TBaseModel,
        formType: FormType,
        apiUrlOverride?: URL,
        miscDataProps?: JSONObject
    ): Promise<
        HTTPResponse<JSONObject | JSONArray | TBaseModel | Array<TBaseModel>>
    > {
        let apiUrl: URL | null = apiUrlOverride || null;

        if (!apiUrl) {
            const apiPath: Route | null = model.getCrudApiPath();
            if (!apiPath) {
                throw new BadDataException(
                    'This model does not support create or update operations.'
                );
            }

            apiUrl = URL.fromURL(DASHBOARD_API_URL).addRoute(apiPath);
        }

        const httpMethod: HTTPMethod =
            formType === FormType.Create ? HTTPMethod.POST : HTTPMethod.PUT;

        if (httpMethod === HTTPMethod.PUT) {
            apiUrl = apiUrl.addRoute(`/${model._id}`);
        }

        const result: HTTPResponse<
            JSONObject | JSONArray | TBaseModel | Array<TBaseModel>
        > = await API.fetch<
            JSONObject | JSONArray | TBaseModel | Array<TBaseModel>
        >(
            httpMethod,
            apiUrl,
            {
                data: model.toJSON(),
                miscDataProps: miscDataProps || {},
            },
            this.getCommonHeaders()
        );

        if (result.isSuccess()) {
            return result;
        }
        throw result;
    }

    public static async getList<TBaseModel extends BaseModel>(
        type: { new (): TBaseModel },
        query: Query<TBaseModel>,
        limit: number,
        skip: number,
        select: Select<TBaseModel>,
        sort: Sort<TBaseModel>,
        populate?: Populate<TBaseModel>
    ): Promise<ListResult<TBaseModel>> {
        const model: TBaseModel = new type();
        const apiPath: Route | null = model.getCrudApiPath();
        if (!apiPath) {
            throw new BadDataException(
                'This model does not support list operations.'
            );
        }

        const apiUrl: URL = URL.fromURL(DASHBOARD_API_URL)
            .addRoute(apiPath)
            .addRoute('/get-list');

        if (!apiUrl) {
            throw new BadDataException(
                'This model does not support list operations.'
            );
        }

        const result: HTTPResponse<JSONArray> | HTTPErrorResponse =
            await API.fetch<JSONArray>(
                HTTPMethod.POST,
                apiUrl,
                {
                    query: JSONFunctions.serialize(query as JSONObject),
                    select: JSONFunctions.serialize(select as JSONObject),
                    sort: JSONFunctions.serialize(sort as JSONObject),
                    populate: populate
                        ? JSONFunctions.serialize(populate as JSONObject)
                        : null,
                },
                this.getCommonHeaders(),
                {
                    limit: limit.toString(),
                    skip: skip.toString(),
                }
            );

        if (result.isSuccess()) {
            const list: Array<TBaseModel> = model.fromJSONArray(
                result.data as JSONArray,
                type
            );

            return {
                data: list,
                count: result.count,
                skip: result.skip,
                limit: result.limit,
            };
        }
        throw result;
    }

    public static getCommonHeaders(): Dictionary<string> {
        const headers: Dictionary<string> = {};

        const project: Project | null = ProjectUtil.getCurrentProject();

        if (project && project.id) {
            headers['projectid'] = project.id.toString();
        }

        return headers;
    }

    public static async getItem<TBaseModel extends BaseModel>(
        type: { new (): TBaseModel },
        id: ObjectID,
        select: Select<TBaseModel>,
        populate?: Populate<TBaseModel>
    ): Promise<TBaseModel | null> {
        const apiPath: Route | null = new type().getCrudApiPath();
        if (!apiPath) {
            throw new BadDataException(
                'This model does not support get operations.'
            );
        }

        const apiUrl: URL = URL.fromURL(DASHBOARD_API_URL)
            .addRoute(apiPath)
            .addRoute('/' + id.toString())
            .addRoute('/get-item');

        if (!apiUrl) {
            throw new BadDataException(
                'This model does not support get operations.'
            );
        }

        const result: HTTPResponse<TBaseModel> | HTTPErrorResponse =
            await API.fetch<TBaseModel>(
                HTTPMethod.POST,
                apiUrl,
                {
                    select: JSONFunctions.serialize(select as JSONObject),
                    populate: populate
                        ? JSONFunctions.serialize(populate as JSONObject)
                        : null,
                },
                this.getCommonHeaders()
            );

        if (result.isSuccess()) {
            return result.data as TBaseModel;
        }
        throw result;
    }

    public static async deleteItem<TBaseModel extends BaseModel>(
        type: { new (): TBaseModel },
        id: ObjectID
    ): Promise<void> {
        const apiPath: Route | null = new type().getCrudApiPath();
        if (!apiPath) {
            throw new BadDataException(
                'This model does not support delete operations.'
            );
        }

        const apiUrl: URL = URL.fromURL(DASHBOARD_API_URL)
            .addRoute(apiPath)
            .addRoute('/' + id.toString());

        if (!apiUrl) {
            throw new BadDataException(
                'This model does not support delete operations.'
            );
        }

        const result: HTTPResponse<TBaseModel> | HTTPErrorResponse =
            await API.fetch<TBaseModel>(
                HTTPMethod.DELETE,
                apiUrl,
                undefined,
                this.getCommonHeaders()
            );

        if (result.isSuccess()) {
            return;
        }

        throw result;
    }
}
