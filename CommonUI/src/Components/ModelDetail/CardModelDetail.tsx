import {
    PermissionHelper,
    UserPermission,
    UserProjectAccessPermission,
} from 'Common/Types/Permission';
import React, { ReactElement, useEffect, useState } from 'react';
import PermissionUtil from '../../Utils/Permission';
import Card, {
    CardButtonSchema,
    ComponentProps as CardProps,
} from '../Card/Card';
import ModelDetail, { ComponentProps as ModeDetailProps } from './ModelDetail';
import BaseModel from 'Common/Models/BaseModel';
import { ButtonStyleType } from '../Button/Button';
import { IconProp } from '../Icon/Icon';
import ModelFromModal from '../ModelFormModal/ModelFormModal';
import { FormType } from '../Forms/ModelForm';
import Fields from '../Forms/Types/Fields';

export interface ComponentProps<TBaseModel extends BaseModel> {
    cardProps: CardProps;
    modelDetailProps: ModeDetailProps<TBaseModel>;
    isEditable?: undefined | boolean;
    formFields?: undefined | Fields<TBaseModel>;
}

const CardModelDetail: Function = <TBaseModel extends BaseModel>(
    props: ComponentProps<TBaseModel>
): ReactElement => {
    const [cardButtons, setCardButtons] = useState<Array<CardButtonSchema>>([]);
    const [showModel, setShowModal] = useState<boolean>(false);
    const [item, setItem] = useState<TBaseModel | null>(null);
    const [refresher, setRefresher] = useState<boolean>(false);

    useEffect(() => {
        const userProjectPermissions: UserProjectAccessPermission | null =
            PermissionUtil.getProjectPermissions();

        const hasPermissionToEdit: boolean = Boolean(
            userProjectPermissions &&
                userProjectPermissions.permissions &&
                PermissionHelper.doesPermissionsIntersect(
                    props.modelDetailProps.model.updateRecordPermissions,
                    userProjectPermissions.permissions.map(
                        (item: UserPermission) => {
                            return item.permission;
                        }
                    )
                )
        );

        if (props.isEditable && hasPermissionToEdit) {
            setCardButtons([
                {
                    title: `Edit ${props.modelDetailProps.model.singularName}`,
                    buttonStyle: ButtonStyleType.OUTLINE,
                    onClick: () => {
                        setShowModal(true);
                    },
                    icon: IconProp.Edit,
                },
            ]);
        }
    }, []);

    return (
        <>
            <Card {...props.cardProps} buttons={cardButtons}>
                <ModelDetail
                    refresher={refresher}
                    {...props.modelDetailProps}
                    onItemLoaded={(item: TBaseModel) => {
                        setItem(item);
                    }}
                />
            </Card>

            {showModel ? (
                <ModelFromModal<TBaseModel>
                    title={`Edit ${props.modelDetailProps.model.singularName}`}
                    onClose={() => {
                        setShowModal(false);
                    }}
                    submitButtonText={`Save Changes`}
                    onSuccess={(_item: TBaseModel) => {
                        setShowModal(false);
                        setRefresher(!refresher);
                    }}
                    type={props.modelDetailProps.type}
                    formProps={{
                        model: props.modelDetailProps.model,
                        id: `edit-${props.modelDetailProps.model.singularName?.toLowerCase()}-from`,
                        fields: props.formFields || [],
                        formType: FormType.Update,
                        type: props.modelDetailProps.type,
                    }}
                    modelIdToEdit={item?._id}
                />
            ) : (
                <></>
            )}
        </>
    );
};

export default CardModelDetail;
