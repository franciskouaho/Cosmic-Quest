import { StyleSheet } from "react-native"

export default StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        justifyContent: "center",
        alignItems: "center",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
    },
    spaceBetween: {
        justifyContent: "space-between",
    },
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    shadow: {
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 12,
    },
    text: {
        fontSize: 16,
    },
    smallText: {
        fontSize: 14,
    },
    button: {
        borderRadius: 30,
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "bold",
    },
    input: {
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 16,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
})

