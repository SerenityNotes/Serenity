import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { View, Text, Icon, tw } from "@serenity-tools/ui";
import { format } from "date-fns";
import { TouchableOpacity } from "react-native-gesture-handler";

type Props = {
  id: string;
  workspaceId: string;
  inviterUserId: string;
  username: string;
  expiresAt: Date;
  onDeletePress: () => void;
};

export function WorkspaceInvitationListItem(props: Props) {
  const id = props.id;
  const username = props.username;
  const expiresAt = props.expiresAt;

  const formatDate = (date: Date) => {
    return format(date, "MMM dd, yyyy");
  };

  return (
    <View style={styles.listItem}>
      <Text>{id}</Text>
      <Text>{username}</Text>
      <Text>{expiresAt}</Text>
      <View>
        <TouchableOpacity onPress={props.onDeletePress}>
          <Icon
            name="close-circle-fill"
            size={18}
            color={tw.color("gray-800")}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
